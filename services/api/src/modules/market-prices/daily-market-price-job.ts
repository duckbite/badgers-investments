import { randomUUID } from 'node:crypto';
import { normalizeCurrencyCode } from '../domain/currency-codes.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import { AssetRepository } from '../assets/asset-repository.js';
import { PortfolioRepository } from '../portfolio/portfolio-repository.js';
import { PriceSnapshotRepository } from '../valuations/price-snapshot-repository.js';
import { SnapshotInvalidationService } from '../snapshots/snapshot-invalidation-service.js';
import { MarketPriceJobStateRepository } from './market-price-job-state-repository.js';
import { PRICE_PROVIDER_KEY_CRYPTO_AGGREGATE, PRICE_PROVIDER_KEY_YAHOO_FINANCE } from './price-provider-keys.js';
import { fetchYahooFinanceV7Quotes, type YahooFinanceQuoteRow } from './yahoo-finance-v7-quote-fetcher.js';

export type DailyMarketPriceJobResult = {
  readonly usersProcessed: number;
  readonly snapshotsWritten: number;
  readonly errors: readonly string[];
};

export class DailyMarketPriceJob {
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly priceSnapshotRepository: PriceSnapshotRepository;
  private readonly snapshotInvalidation: SnapshotInvalidationService;
  private readonly marketPriceJobStateRepository: MarketPriceJobStateRepository;

  public constructor(input: {
    readonly assetRepository: AssetRepository;
    readonly portfolioRepository: PortfolioRepository;
    readonly priceSnapshotRepository: PriceSnapshotRepository;
    readonly snapshotInvalidation: SnapshotInvalidationService;
    readonly marketPriceJobStateRepository: MarketPriceJobStateRepository;
  }) {
    this.assetRepository = input.assetRepository;
    this.portfolioRepository = input.portfolioRepository;
    this.priceSnapshotRepository = input.priceSnapshotRepository;
    this.snapshotInvalidation = input.snapshotInvalidation;
    this.marketPriceJobStateRepository = input.marketPriceJobStateRepository;
  }

  public async runForUserIds(input: { readonly userIds: readonly string[]; readonly now: Date }): Promise<DailyMarketPriceJobResult> {
    const errors: string[] = [];
    let usersProcessed: number = 0;
    let snapshotsWritten: number = 0;
    for (const userId of input.userIds) {
      try {
        const n: number = await this.runForUser({ userId, now: input.now });
        snapshotsWritten += n;
        usersProcessed += 1;
      } catch (err) {
        const message: string = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`userId=${userId}: ${message}`);
      }
    }
    return { usersProcessed, snapshotsWritten, errors };
  }

  private async runForUser(input: { readonly userId: string; readonly now: Date }): Promise<number> {
    const portfolio = await this.portfolioRepository.findByUserId({ userId: input.userId });
    if (portfolio === undefined) {
      return 0;
    }
    const portfolioId: string = portfolio.portfolioId;
    const startedAtIso: string = input.now.toISOString();
    await this.marketPriceJobStateRepository.put({
      userId: input.userId,
      portfolioId,
      record: {
        lastRunStartedAtIso: startedAtIso,
        lastRunFinishedAtIso: undefined,
        lastRunOk: undefined,
        lastRunErrorMessage: undefined,
        symbolsProcessed: undefined,
        lastProviderKey: PRICE_PROVIDER_KEY_YAHOO_FINANCE,
      },
      updatedAtIso: startedAtIso,
    });
    let written: number = 0;
    let errorMessage: string | undefined;
    try {
      const assets: readonly AssetRecord[] = await this.assetRepository.listByPortfolio({ userId: input.userId, portfolioId });
      const yahooAssets: AssetRecord[] = assets.filter((a) => isActiveYahooCandidateAsset({ asset: a }));
      const symbols: string[] = yahooAssets.map((a) => a.symbol.trim()).filter((s) => s.length > 0);
      const quotes: readonly YahooFinanceQuoteRow[] =
        symbols.length === 0 ? [] : await fetchYahooFinanceV7Quotes({ symbols, now: input.now });
      const quoteBySymbol: Map<string, YahooFinanceQuoteRow> = buildQuoteLookup({ quotes });
      for (const asset of yahooAssets) {
        const q: YahooFinanceQuoteRow | undefined = lookupQuote({ symbol: asset.symbol, quoteBySymbol });
        if (q === undefined) {
          continue;
        }
        const assetCurrency: string = normalizeCurrencyCode({ raw: asset.currencyCode });
        const quoteCurrency: string = normalizeCurrencyCode({ raw: q.currencyCode });
        if (assetCurrency !== quoteCurrency) {
          continue;
        }
        const hadNoProvider: boolean = asset.primaryPriceProviderKey === undefined;
        const priceSnapshotId: string = randomUUID();
        const createdAtIso: string = input.now.toISOString();
        await this.priceSnapshotRepository.create({
          userId: input.userId,
          portfolioId,
          priceSnapshotId,
          assetId: asset.assetId,
          price: q.price,
          currencyCode: assetCurrency,
          priceTimestampIso: q.priceTimestampIso,
          priceDate: q.priceDate,
          providerKey: PRICE_PROVIDER_KEY_YAHOO_FINANCE,
          dataQuality: q.dataQuality,
          rawPayloadHash: q.rawPayloadHash,
          createdAtIso,
        });
        await this.snapshotInvalidation.notifyPriceDate({
          userId: input.userId,
          portfolioId,
          priceDate: q.priceDate,
          nowIso: createdAtIso,
        });
        if (hadNoProvider) {
          await this.assetRepository.update({
            userId: input.userId,
            portfolioId,
            assetId: asset.assetId,
            name: undefined,
            symbol: undefined,
            ownershipPct: undefined,
            notes: undefined,
            isin: undefined,
            exchangeCode: undefined,
            sector: undefined,
            primaryPriceProviderKey: PRICE_PROVIDER_KEY_YAHOO_FINANCE,
            isActive: undefined,
            archivedAtIso: undefined,
            updatedAtIso: createdAtIso,
          });
        }
        written += 1;
      }
      const finishedAtIso: string = input.now.toISOString();
      await this.marketPriceJobStateRepository.put({
        userId: input.userId,
        portfolioId,
        record: {
          lastRunStartedAtIso: startedAtIso,
          lastRunFinishedAtIso: finishedAtIso,
          lastRunOk: true,
          lastRunErrorMessage: undefined,
          symbolsProcessed: quotes.length,
          lastProviderKey: PRICE_PROVIDER_KEY_YAHOO_FINANCE,
        },
        updatedAtIso: finishedAtIso,
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const finishedAtIso: string = input.now.toISOString();
      await this.marketPriceJobStateRepository.put({
        userId: input.userId,
        portfolioId,
        record: {
          lastRunStartedAtIso: startedAtIso,
          lastRunFinishedAtIso: finishedAtIso,
          lastRunOk: false,
          lastRunErrorMessage: errorMessage,
          symbolsProcessed: undefined,
          lastProviderKey: PRICE_PROVIDER_KEY_YAHOO_FINANCE,
        },
        updatedAtIso: finishedAtIso,
      });
      throw err;
    }
    return written;
  }
}

function isActiveYahooCandidateAsset(input: { readonly asset: AssetRecord }): boolean {
  const a: AssetRecord = input.asset;
  if (!a.isActive) {
    return false;
  }
  if (a.assetType !== 'STOCK' && a.assetType !== 'ETF') {
    return false;
  }
  if (a.primaryPriceProviderKey === PRICE_PROVIDER_KEY_CRYPTO_AGGREGATE) {
    return false;
  }
  if (a.primaryPriceProviderKey === undefined || a.primaryPriceProviderKey === PRICE_PROVIDER_KEY_YAHOO_FINANCE) {
    return true;
  }
  return false;
}

function buildQuoteLookup(input: { readonly quotes: readonly YahooFinanceQuoteRow[] }): Map<string, YahooFinanceQuoteRow> {
  const map: Map<string, YahooFinanceQuoteRow> = new Map();
  for (const q of input.quotes) {
    map.set(q.symbol.trim().toUpperCase(), q);
  }
  return map;
}

function lookupQuote(input: { readonly symbol: string; readonly quoteBySymbol: Map<string, YahooFinanceQuoteRow> }): YahooFinanceQuoteRow | undefined {
  const key: string = input.symbol.trim().toUpperCase();
  return input.quoteBySymbol.get(key);
}
