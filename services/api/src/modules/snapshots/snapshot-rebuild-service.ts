import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Decimal } from 'decimal.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import { AssetRepository } from '../assets/asset-repository.js';
import { computeDailyTwrChain, getTwrDailyV1Metadata } from '../performance/twr-daily-v1.js';
import { FifoHoldingsService } from '../ledger/fifo-holdings-service.js';
import type { TransactionRecord } from '../ledger/transaction-repository.js';
import { TransactionRepository } from '../ledger/transaction-repository.js';
import type { PortfolioRecord } from '../portfolio/portfolio-repository.js';
import { PortfolioRepository } from '../portfolio/portfolio-repository.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import { PriceSnapshotRepository } from '../valuations/price-snapshot-repository.js';
import {
  endOfUtcDayIso,
  isTransactionIncludedAsOf,
  iterateDateRangeInclusive,
  minIsoDateString,
  utcCalendarDateYmd,
} from './snapshot-date-utils.js';
import { PerformanceSnapshotRepository } from './performance-snapshot-repository.js';
import { PortfolioSnapshotRepository } from './portfolio-snapshot-repository.js';
import { PositionSnapshotRepository } from './position-snapshot-repository.js';
import { purgeSnapshotsFromDateOnward } from './snapshot-purge.js';
import { SnapshotStateRepository } from './snapshot-state-repository.js';

export type SnapshotRebuildResultDto = {
  readonly fromDate: string;
  readonly throughDate: string;
  readonly daysProcessed: number;
  readonly earliestAffectedCleared: boolean;
};

export class SnapshotRebuildService {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly transactionRepository: TransactionRepository;
  private readonly fifoHoldingsService: FifoHoldingsService;
  private readonly priceSnapshotRepository: PriceSnapshotRepository;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly snapshotStateRepository: SnapshotStateRepository;
  private readonly positionSnapshotRepository: PositionSnapshotRepository;
  private readonly portfolioSnapshotRepository: PortfolioSnapshotRepository;
  private readonly performanceSnapshotRepository: PerformanceSnapshotRepository;
  private readonly portfolioService: PortfolioService;

  public constructor(input: {
    readonly documentClient: DynamoDBDocumentClient;
    readonly tableName: string;
    readonly transactionRepository: TransactionRepository;
    readonly fifoHoldingsService: FifoHoldingsService;
    readonly priceSnapshotRepository: PriceSnapshotRepository;
    readonly assetRepository: AssetRepository;
    readonly portfolioRepository: PortfolioRepository;
    readonly snapshotStateRepository: SnapshotStateRepository;
    readonly positionSnapshotRepository: PositionSnapshotRepository;
    readonly portfolioSnapshotRepository: PortfolioSnapshotRepository;
    readonly performanceSnapshotRepository: PerformanceSnapshotRepository;
    readonly portfolioService: PortfolioService;
  }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
    this.transactionRepository = input.transactionRepository;
    this.fifoHoldingsService = input.fifoHoldingsService;
    this.priceSnapshotRepository = input.priceSnapshotRepository;
    this.assetRepository = input.assetRepository;
    this.portfolioRepository = input.portfolioRepository;
    this.snapshotStateRepository = input.snapshotStateRepository;
    this.positionSnapshotRepository = input.positionSnapshotRepository;
    this.portfolioSnapshotRepository = input.portfolioSnapshotRepository;
    this.performanceSnapshotRepository = input.performanceSnapshotRepository;
    this.portfolioService = input.portfolioService;
  }

  public async rebuild(input: {
    readonly userId: string;
    readonly now: Date;
    readonly throughDate: string | undefined;
  }): Promise<SnapshotRebuildResultDto> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const throughDate: string = input.throughDate ?? utcCalendarDateYmd({ instant: input.now });
    const portfolio: PortfolioRecord | undefined = await this.portfolioRepository.getById({ userId: input.userId, portfolioId });
    if (portfolio === undefined) {
      throw new Error('Portfolio not found for rebuild.');
    }
    const rows: readonly TransactionRecord[] = await this.transactionRepository.listByPortfolio({
      userId: input.userId,
      portfolioId,
    });
    const activeTradeDates: string[] = rows.filter((r) => !r.isDeleted).map((r) => r.tradeDate);
    const firstTradeDate: string | undefined = minIsoDateString({ dates: activeTradeDates });
    if (firstTradeDate === undefined) {
      const stateOnly = await this.snapshotStateRepository.get({
        userId: input.userId,
        portfolioId,
      });
      if (stateOnly?.earliestAffectedDate !== undefined) {
        await this.snapshotStateRepository.put({
          userId: input.userId,
          portfolioId,
          earliestAffectedDate: undefined,
          updatedAtIso: input.now.toISOString(),
        });
      }
      return { fromDate: throughDate, throughDate, daysProcessed: 0, earliestAffectedCleared: stateOnly?.earliestAffectedDate !== undefined };
    }
    const state = await this.snapshotStateRepository.get({ userId: input.userId, portfolioId });
    const fromDate: string =
      state?.earliestAffectedDate === undefined ? firstTradeDate : minIsoDateString({ dates: [state.earliestAffectedDate, firstTradeDate] })!;
    if (fromDate > throughDate) {
      return { fromDate, throughDate, daysProcessed: 0, earliestAffectedCleared: false };
    }
    await purgeSnapshotsFromDateOnward({
      documentClient: this.documentClient,
      tableName: this.tableName,
      userId: input.userId,
      portfolioId,
      fromDateInclusive: fromDate,
      skNamespace: 'POS_SNAP#',
    });
    await purgeSnapshotsFromDateOnward({
      documentClient: this.documentClient,
      tableName: this.tableName,
      userId: input.userId,
      portfolioId,
      fromDateInclusive: fromDate,
      skNamespace: 'PORT_SNAP#',
    });
    await purgeSnapshotsFromDateOnward({
      documentClient: this.documentClient,
      tableName: this.tableName,
      userId: input.userId,
      portfolioId,
      fromDateInclusive: fromDate,
      skNamespace: 'PERF_SNAP#',
    });
    const dates: readonly string[] = iterateDateRangeInclusive({ from: fromDate, to: throughDate });
    const createdAtIso: string = input.now.toISOString();
    for (const day of dates) {
      await this.writeDaySnapshots({
        userId: input.userId,
        portfolioId,
        portfolio,
        day,
        allTransactions: rows,
        createdAtIso,
      });
    }
    const allPortfolioSnaps = await this.portfolioSnapshotRepository.listAllAscending({ userId: input.userId, portfolioId });
    const twrMeta = getTwrDailyV1Metadata();
    const chain = computeDailyTwrChain({
      values: allPortfolioSnaps.map((s) => ({ snapshotDate: s.snapshotDate, totalMarketValueAmount: s.totalMarketValueAmount })),
    });
    for (const point of chain) {
      if (point.periodDate < fromDate) {
        continue;
      }
      await this.performanceSnapshotRepository.put({
        userId: input.userId,
        portfolioId,
        periodDate: point.periodDate,
        asOfTimestampIso: endOfUtcDayIso({ dateYmd: point.periodDate }),
        subperiodReturn: point.subperiodReturn,
        cumulativeTwrReturn: point.cumulativeTwrReturn,
        valuationStartAmount: point.valuationStartAmount,
        valuationEndAmount: point.valuationEndAmount,
        externalCashFlowsAmount: '0',
        calculationMethod: twrMeta.calculationMethod,
        calculationVersion: twrMeta.calculationVersion,
        createdAtIso,
      });
    }
    await this.snapshotStateRepository.put({
      userId: input.userId,
      portfolioId,
      earliestAffectedDate: undefined,
      updatedAtIso: createdAtIso,
    });
    return { fromDate, throughDate, daysProcessed: dates.length, earliestAffectedCleared: true };
  }

  private async writeDaySnapshots(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly portfolio: PortfolioRecord;
    readonly day: string;
    readonly allTransactions: readonly TransactionRecord[];
    readonly createdAtIso: string;
  }): Promise<void> {
    const included: TransactionRecord[] = input.allTransactions.filter((tx) =>
      isTransactionIncludedAsOf({ tx, asOfDateYmd: input.day }),
    );
    const fifo = this.fifoHoldingsService.compute({
      transactions: included,
      nowIso: endOfUtcDayIso({ dateYmd: input.day }),
    });
    const positionInputs: {
      readonly assetId: string;
      readonly quantityHeld: string;
      readonly costBasisAmount: string;
      readonly marketPrice: string | undefined;
      readonly marketPriceCurrencyCode: string | undefined;
      readonly marketValueAmount: string;
      readonly unrealisedPnlAmount: string;
      readonly realisedPnlCumulativeAmount: string;
      readonly dataSourceSummaryJson: string;
    }[] = [];
    let totalMarket: Decimal = new Decimal(0);
    let totalUnrealised: Decimal = new Decimal(0);
    let totalRealised: Decimal = new Decimal(0);
    const allocationBase: { readonly assetId: string; readonly marketValue: Decimal }[] = [];
    let summaryFlags: { readonly missingPrice: boolean; readonly skippedFx: boolean } = { missingPrice: false, skippedFx: false };
    for (const row of fifo.positions) {
      const qty: Decimal = new Decimal(row.quantityHeld);
      if (qty.lte(0)) {
        continue;
      }
      const asset: AssetRecord | undefined = await this.assetRepository.getById({
        userId: input.userId,
        portfolioId: input.portfolioId,
        assetId: row.assetId,
      });
      if (asset === undefined || !asset.isActive) {
        continue;
      }
      const ownership: Decimal = new Decimal(asset.ownershipPct).div(100);
      const costOwned: Decimal = new Decimal(row.costBasisRemaining).mul(ownership);
      const realisedOwned: Decimal = new Decimal(row.realisedPnlAmount).mul(ownership);
      const priceRow = await this.priceSnapshotRepository.findLatestForAssetOnOrBeforeDate({
        userId: input.userId,
        portfolioId: input.portfolioId,
        assetId: row.assetId,
        onOrBeforeDate: input.day,
      });
      const currencyMismatch: boolean = asset.currencyCode !== input.portfolio.baseCurrencyCode;
      let marketPrice: string | undefined;
      let mv: Decimal;
      let unrealised: Decimal;
      if (priceRow === undefined || currencyMismatch) {
        if (priceRow === undefined) {
          summaryFlags = { ...summaryFlags, missingPrice: true };
        }
        if (currencyMismatch) {
          summaryFlags = { ...summaryFlags, skippedFx: true };
        }
        marketPrice = undefined;
        mv = new Decimal(0);
        unrealised = new Decimal(0).sub(costOwned);
      } else {
        marketPrice = priceRow.price;
        const unit: Decimal = new Decimal(priceRow.price);
        mv = qty.mul(unit).mul(ownership);
        unrealised = mv.sub(costOwned);
      }
      const dataSourceSummaryJson: string = JSON.stringify({
        priceSnapshotId: priceRow?.priceSnapshotId,
        missingPrice: priceRow === undefined,
        skippedFx: currencyMismatch,
      });
      positionInputs.push({
        assetId: row.assetId,
        quantityHeld: row.quantityHeld,
        costBasisAmount: costOwned.toFixed(),
        marketPrice,
        marketPriceCurrencyCode: currencyMismatch ? undefined : asset.currencyCode,
        marketValueAmount: mv.toFixed(),
        unrealisedPnlAmount: unrealised.toFixed(),
        realisedPnlCumulativeAmount: realisedOwned.toFixed(),
        dataSourceSummaryJson,
      });
      totalMarket = totalMarket.add(mv);
      totalUnrealised = totalUnrealised.add(unrealised);
      totalRealised = totalRealised.add(realisedOwned);
      allocationBase.push({ assetId: row.assetId, marketValue: mv });
    }
    const allocationByAsset: Record<string, string> = {};
    for (const entry of allocationBase) {
      const pct: Decimal =
        totalMarket.lte(0) || entry.marketValue.lte(0) ? new Decimal(0) : entry.marketValue.div(totalMarket).mul(100);
      allocationByAsset[entry.assetId] = pct.toFixed(4);
    }
    const portfolioSummaryJson: string = JSON.stringify({
      missingPrice: summaryFlags.missingPrice,
      skippedFx: summaryFlags.skippedFx,
    });
    for (const p of positionInputs) {
      const allocationPct: string | undefined = allocationByAsset[p.assetId];
      await this.positionSnapshotRepository.put({
        userId: input.userId,
        portfolioId: input.portfolioId,
        snapshotDate: input.day,
        assetId: p.assetId,
        quantityHeld: p.quantityHeld,
        costBasisAmount: p.costBasisAmount,
        marketPrice: p.marketPrice,
        marketPriceCurrencyCode: p.marketPriceCurrencyCode,
        marketValueAmount: p.marketValueAmount,
        unrealisedPnlAmount: p.unrealisedPnlAmount,
        realisedPnlCumulativeAmount: p.realisedPnlCumulativeAmount,
        allocationPct,
        dataSourceSummaryJson: p.dataSourceSummaryJson,
        createdAtIso: input.createdAtIso,
      });
    }
    await this.portfolioSnapshotRepository.put({
      userId: input.userId,
      portfolioId: input.portfolioId,
      snapshotDate: input.day,
      totalMarketValueAmount: totalMarket.toFixed(),
      totalUnrealisedPnlAmount: totalUnrealised.toFixed(),
      totalRealisedPnlAmount: totalRealised.toFixed(),
      allocationByAssetJson: JSON.stringify(allocationByAsset),
      dataSourceSummaryJson: portfolioSummaryJson,
      createdAtIso: input.createdAtIso,
    });
  }
}
