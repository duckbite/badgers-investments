import { Decimal } from 'decimal.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import type { PortfolioConfigFullDto } from '../portfolio/portfolio-config-service.js';
import type { PortfolioSnapshotRecord } from '../snapshots/portfolio-snapshot-repository.js';
import type { PositionSnapshotRecord } from '../snapshots/position-snapshot-repository.js';
import type { PerformanceSnapshotRecord } from '../snapshots/performance-snapshot-repository.js';
import { endOfUtcDayIso } from '../snapshots/snapshot-date-utils.js';
import type { PriceSnapshotRecord } from '../valuations/price-snapshot-repository.js';
import { ANALYTICS_SCHEMA_VERSION } from './recommendation-engine-constants.js';
import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';
import {
  buildAnalyticsConfigBlock,
  isCryptoAsset,
  parseTargetRowsFromConfig,
  resolveAssetAllocationBucket,
} from './parse-portfolio-config-for-analytics.js';
import { computeTwrWindowsForAnalytics } from './recommendation-twr-windows.js';

type PositionDataSource = {
  readonly missingPrice: boolean;
  readonly skippedFx: boolean;
  readonly priceSnapshotId: string | undefined;
};

function parsePositionDataSource(input: { readonly json: string }): PositionDataSource {
  try {
    const raw: unknown = JSON.parse(input.json);
    if (typeof raw !== 'object' || raw === null) {
      return { missingPrice: true, skippedFx: false, priceSnapshotId: undefined };
    }
    const record: Record<string, unknown> = raw as Record<string, unknown>;
    return {
      missingPrice: record['missingPrice'] === true,
      skippedFx: record['skippedFx'] === true,
      priceSnapshotId: typeof record['priceSnapshotId'] === 'string' ? record['priceSnapshotId'] : undefined,
    };
  } catch {
    return { missingPrice: true, skippedFx: false, priceSnapshotId: undefined };
  }
}

function toNumber(input: { readonly decimalString: string }): number {
  return new Decimal(input.decimalString).toNumber();
}

function hoursBetweenPriceAndValuation(input: { readonly priceRow: PriceSnapshotRecord; readonly valuationEndIso: string }): number {
  const priceMs: number = new Date(input.priceRow.priceTimestampIso).getTime();
  const valMs: number = new Date(input.valuationEndIso).getTime();
  return (valMs - priceMs) / 3600000;
}

export async function buildRecommendationAnalyticsPayload(input: {
  readonly portfolioId: string;
  readonly snapshotDate: string;
  readonly portfolioSnapshot: PortfolioSnapshotRecord;
  readonly positionRows: readonly PositionSnapshotRecord[];
  readonly performanceRows: readonly PerformanceSnapshotRecord[];
  readonly assetsById: ReadonlyMap<string, AssetRecord>;
  readonly config: PortfolioConfigFullDto;
  readonly priceResolve: (assetId: string) => Promise<PriceSnapshotRecord | undefined>;
}): Promise<RecommendationAnalyticsPayload> {
  const targetRows = parseTargetRowsFromConfig({ config: input.config });
  const configBlock = buildAnalyticsConfigBlock({ config: input.config, targetRows });
  const valuationEndIso: string = endOfUtcDayIso({ dateYmd: input.snapshotDate });
  const valuationTs: string = new Date(valuationEndIso).toISOString();
  const totalOwned: number = toNumber({ decimalString: input.portfolioSnapshot.totalMarketValueAmount });
  const unrealisedTotal: number = toNumber({ decimalString: input.portfolioSnapshot.totalUnrealisedPnlAmount });
  const realisedTotal: number = toNumber({ decimalString: input.portfolioSnapshot.totalRealisedPnlAmount });
  const twrBlock = computeTwrWindowsForAnalytics({ rows: input.performanceRows, asOfYmd: input.snapshotDate });
  const bucketValues: Record<string, Decimal> = {};
  for (const row of targetRows) {
    bucketValues[row.assetClass] = new Decimal(0);
  }
  if (targetRows.length === 0) {
    bucketValues['UNCLASSIFIED'] = new Decimal(0);
  }
  const analyticsAssets: RecommendationAnalyticsPayload['assets'][number][] = [];
  let marketAssetCount = 0;
  let pricedCount = 0;
  let stalePriceCount = 0;
  const warnings: string[] = [];
  const staleHoursThresholdWarn = 48;
  const staleHoursThresholdHigh = 120;
  for (const pos of input.positionRows) {
    const asset: AssetRecord | undefined = input.assetsById.get(pos.assetId);
    if (asset === undefined || !asset.isActive) {
      continue;
    }
    marketAssetCount += 1;
    const ds: PositionDataSource = parsePositionDataSource({ json: pos.dataSourceSummaryJson });
    const valueOwned: number = toNumber({ decimalString: pos.marketValueAmount });
    const allocPct: number =
      pos.allocationPct !== undefined ? toNumber({ decimalString: pos.allocationPct }) : totalOwned > 0 ? (valueOwned / totalOwned) * 100 : 0;
    let priceRow: PriceSnapshotRecord | undefined;
    if (!ds.missingPrice && !ds.skippedFx) {
      priceRow = await input.priceResolve(pos.assetId);
    }
    const priceFreshnessHours: number | null =
      priceRow === undefined ? null : hoursBetweenPriceAndValuation({ priceRow, valuationEndIso });
    const hasStalePrice: boolean =
      priceFreshnessHours !== null &&
      allocPct >= 5 &&
      ((priceFreshnessHours > staleHoursThresholdWarn && priceFreshnessHours <= staleHoursThresholdHigh) ||
        priceFreshnessHours > staleHoursThresholdHigh);
    if (priceFreshnessHours !== null && priceFreshnessHours > staleHoursThresholdWarn && allocPct >= 5) {
      stalePriceCount += 1;
    }
    if (!ds.missingPrice && !ds.skippedFx && priceRow !== undefined) {
      pricedCount += 1;
    }
    const unrealised: number = toNumber({ decimalString: pos.unrealisedPnlAmount });
    const cost: number = toNumber({ decimalString: pos.costBasisAmount });
    const currentPrice: number | null =
      pos.marketPrice !== undefined && !ds.missingPrice && !ds.skippedFx ? toNumber({ decimalString: pos.marketPrice }) : null;
    analyticsAssets.push({
      asset_id: pos.assetId,
      name: asset.name,
      symbol: asset.symbol,
      asset_type: asset.assetType,
      currency: asset.currencyCode,
      ownership_pct: toNumber({ decimalString: asset.ownershipPct }),
      quantity_held: toNumber({ decimalString: pos.quantityHeld }),
      current_price: currentPrice,
      current_value_owned: valueOwned,
      cost_basis: cost,
      unrealised_pnl: unrealised,
      realised_pnl_cumulative: toNumber({ decimalString: pos.realisedPnlCumulativeAmount }),
      allocation_pct: allocPct,
      price_freshness_hours: priceFreshnessHours,
      has_stale_price: hasStalePrice,
      trend_signals: { enabled: false },
    });
    const bucket: string = resolveAssetAllocationBucket({ asset, targetRows });
    if (bucketValues[bucket] === undefined) {
      bucketValues[bucket] = new Decimal(0);
    }
    bucketValues[bucket] = bucketValues[bucket].add(new Decimal(valueOwned));
  }
  const byAssetType = Object.entries(bucketValues).map(([asset_type, value]) => ({
    asset_type,
    value_owned: value.toNumber(),
    pct_owned: totalOwned > 0 ? value.div(totalOwned).mul(100).toNumber() : 0,
  }));
  const top_holdings = analyticsAssets
    .slice()
    .sort((a, b) => b.current_value_owned - a.current_value_owned)
    .slice(0, 10)
    .map((a) => ({
      asset_id: a.asset_id,
      name: a.name,
      symbol: a.symbol,
      asset_type: a.asset_type,
      sector: input.assetsById.get(a.asset_id)?.sector ?? null,
      value_owned: a.current_value_owned,
      allocation_pct: a.allocation_pct,
      unrealised_pnl: a.unrealised_pnl,
      price_freshness_hours: a.price_freshness_hours,
    }));
  const cryptoPct: number = analyticsAssets
    .filter((a) => {
      const ar: AssetRecord | undefined = input.assetsById.get(a.asset_id);
      return ar !== undefined && isCryptoAsset({ asset: ar });
    })
    .reduce((sum, a) => sum + a.allocation_pct, 0);
  if (cryptoPct > 0 && !Object.prototype.hasOwnProperty.call(configBlock.concentration_limits, 'max_crypto_pct')) {
    warnings.push('Crypto exposure detected but max_crypto_pct is not set in concentration limits.');
  }
  return {
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    snapshot_date: input.snapshotDate,
    portfolio: {
      portfolio_id: input.portfolioId,
      base_currency: input.config.baseCurrencyCode,
      as_of_timestamp: valuationTs,
      valuation_timestamp: valuationTs,
      total_value_owned: totalOwned,
      total_value_full: totalOwned,
      cash_value_owned: 0,
      realised_pnl_total: realisedTotal,
      unrealised_pnl_total: unrealisedTotal,
      twr: twrBlock,
    },
    config: configBlock,
    allocations: { by_asset_type: byAssetType, top_holdings },
    assets: analyticsAssets,
    quality: {
      asset_count: analyticsAssets.length,
      market_asset_count: marketAssetCount,
      priced_asset_count: pricedCount,
      stale_price_asset_count: stalePriceCount,
      manual_valuation_asset_count: 0,
      stale_manual_valuation_count: 0,
      warnings,
    },
  };
}
