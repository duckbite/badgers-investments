import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { isAllowedCurrencyCode, normalizeCurrencyCode } from '../domain/currency-codes.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import type { AssetService } from '../assets/asset-service.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { SnapshotInvalidationService } from '../snapshots/snapshot-invalidation-service.js';
import { utcCalendarDateYmd } from '../snapshots/snapshot-date-utils.js';
import type { PriceSnapshotRecord } from './price-snapshot-repository.js';
import { PriceSnapshotRepository } from './price-snapshot-repository.js';

export type PriceSnapshotDto = {
  readonly priceSnapshotId: string;
  readonly assetId: string;
  readonly price: string;
  readonly currencyCode: string;
  readonly priceTimestamp: string;
  readonly priceDate: string;
  readonly providerKey: string | undefined;
  readonly createdAt: string;
};

export type ManualPriceBody = {
  readonly assetId: string;
  readonly price: string;
  readonly currencyCode: string;
  readonly priceTimestamp: string | undefined;
  readonly priceDate: string | undefined;
};

export class PriceSnapshotValidationError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

export class PriceSnapshotService {
  private readonly priceSnapshotRepository: PriceSnapshotRepository;
  private readonly assetService: AssetService;
  private readonly portfolioService: PortfolioService;
  private readonly snapshotInvalidation: SnapshotInvalidationService | undefined;

  public constructor(input: {
    readonly priceSnapshotRepository: PriceSnapshotRepository;
    readonly assetService: AssetService;
    readonly portfolioService: PortfolioService;
    readonly snapshotInvalidation: SnapshotInvalidationService | undefined;
  }) {
    this.priceSnapshotRepository = input.priceSnapshotRepository;
    this.assetService = input.assetService;
    this.portfolioService = input.portfolioService;
    this.snapshotInvalidation = input.snapshotInvalidation;
  }

  public async createManual(input: { readonly userId: string; readonly body: ManualPriceBody; readonly now: Date }): Promise<PriceSnapshotDto> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const asset: AssetRecord | undefined = await this.assetService.getById({
      userId: input.userId,
      assetId: input.body.assetId,
      now: input.now,
    });
    if (asset === undefined || asset.portfolioId !== portfolioId) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_ASSET_NOT_FOUND', message: 'Asset not found for this portfolio.' });
    }
    const currencyCode: string = normalizeCurrencyCode({ raw: input.body.currencyCode });
    if (!isAllowedCurrencyCode({ raw: currencyCode })) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_CURRENCY_INVALID', message: 'currencyCode is not allowed.' });
    }
    if (currencyCode !== normalizeCurrencyCode({ raw: asset.currencyCode })) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_CURRENCY_MISMATCH', message: 'Price currency must match asset currency.' });
    }
    const price: Decimal = new Decimal(input.body.price);
    if (!price.isFinite() || price.lte(0)) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_AMOUNT_INVALID', message: 'price must be a positive decimal.' });
    }
    const priceTimestampIso: string = input.body.priceTimestamp ?? input.now.toISOString();
    const priceDate: string = input.body.priceDate ?? utcCalendarDateYmd({ instant: new Date(priceTimestampIso) });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priceDate)) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_DATE_INVALID', message: 'priceDate must be YYYY-MM-DD when provided.' });
    }
    const priceSnapshotId: string = randomUUID();
    const createdAtIso: string = input.now.toISOString();
    await this.priceSnapshotRepository.create({
      userId: input.userId,
      portfolioId,
      priceSnapshotId,
      assetId: input.body.assetId,
      price: price.toFixed(),
      currencyCode,
      priceTimestampIso,
      priceDate,
      providerKey: 'MANUAL',
      createdAtIso,
    });
    if (this.snapshotInvalidation !== undefined) {
      await this.snapshotInvalidation.notifyPriceDate({
        userId: input.userId,
        portfolioId,
        priceDate,
        nowIso: createdAtIso,
      });
    }
    return {
      priceSnapshotId,
      assetId: input.body.assetId,
      price: price.toFixed(),
      currencyCode,
      priceTimestamp: priceTimestampIso,
      priceDate,
      providerKey: 'MANUAL',
      createdAt: createdAtIso,
    };
  }

  public async listForAsset(input: {
    readonly userId: string;
    readonly assetId: string;
    readonly limit: number | undefined;
    readonly now: Date;
  }): Promise<readonly PriceSnapshotDto[]> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const asset: AssetRecord | undefined = await this.assetService.getById({
      userId: input.userId,
      assetId: input.assetId,
      now: input.now,
    });
    if (asset === undefined || asset.portfolioId !== portfolioId) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_ASSET_NOT_FOUND', message: 'Asset not found for this portfolio.' });
    }
    const rows: readonly PriceSnapshotRecord[] = await this.priceSnapshotRepository.listForAsset({
      userId: input.userId,
      portfolioId,
      assetId: input.assetId,
      limit: input.limit,
      scanNewestFirst: true,
    });
    return rows.map((row) => toDto({ record: row }));
  }

  public async getLatestForAsset(input: { readonly userId: string; readonly assetId: string; readonly now: Date }): Promise<PriceSnapshotDto | undefined> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const asset: AssetRecord | undefined = await this.assetService.getById({
      userId: input.userId,
      assetId: input.assetId,
      now: input.now,
    });
    if (asset === undefined || asset.portfolioId !== portfolioId) {
      throw new PriceSnapshotValidationError({ code: 'PRICE_ASSET_NOT_FOUND', message: 'Asset not found for this portfolio.' });
    }
    const today: string = utcCalendarDateYmd({ instant: input.now });
    const row: PriceSnapshotRecord | undefined = await this.priceSnapshotRepository.findLatestForAssetOnOrBeforeDate({
      userId: input.userId,
      portfolioId,
      assetId: input.assetId,
      onOrBeforeDate: today,
    });
    if (row === undefined) {
      return undefined;
    }
    return toDto({ record: row });
  }
}

function toDto(input: { readonly record: PriceSnapshotRecord }): PriceSnapshotDto {
  return {
    priceSnapshotId: input.record.priceSnapshotId,
    assetId: input.record.assetId,
    price: input.record.price,
    currencyCode: input.record.currencyCode,
    priceTimestamp: input.record.priceTimestampIso,
    priceDate: input.record.priceDate,
    providerKey: input.record.providerKey,
    createdAt: input.record.createdAtIso,
  };
}
