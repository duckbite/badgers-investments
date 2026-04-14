import { Decimal } from 'decimal.js';
import type { PortfolioConfigFullDto } from '../portfolio/portfolio-config-service.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import type { RecommendationAnalyticsConfig, RecommendationAnalyticsConfigBucket } from './recommendation-analytics-payload-types.js';

type TargetRow = {
  readonly assetClass: string;
  readonly targetPct: string;
  readonly minPct: string;
  readonly maxPct: string;
};

export function parseTargetRowsFromConfig(input: { readonly config: PortfolioConfigFullDto }): readonly TargetRow[] {
  const raw: unknown = input.config.targetAllocations;
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: TargetRow[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record: Record<string, unknown> = entry as Record<string, unknown>;
    const assetClass: unknown = record['assetClass'];
    const targetPct: unknown = record['targetPct'];
    const minPct: unknown = record['minPct'];
    const maxPct: unknown = record['maxPct'];
    if (
      typeof assetClass !== 'string' ||
      typeof targetPct !== 'string' ||
      typeof minPct !== 'string' ||
      typeof maxPct !== 'string'
    ) {
      continue;
    }
    rows.push({ assetClass: assetClass.trim(), targetPct, minPct, maxPct });
  }
  return rows;
}

export function parseConcentrationLimitsForAnalytics(input: { readonly config: PortfolioConfigFullDto }): Readonly<Record<string, number>> {
  const raw: unknown = input.config.concentrationLimits;
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const n: number = new Decimal(value).toNumber();
      if (!Number.isNaN(n)) {
        out[key] = n;
      }
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function buildAnalyticsConfigBlock(input: {
  readonly config: PortfolioConfigFullDto;
  readonly targetRows: readonly TargetRow[];
}): RecommendationAnalyticsConfig {
  const target_allocations: Record<string, RecommendationAnalyticsConfigBucket> = {};
  for (const row of input.targetRows) {
    target_allocations[row.assetClass] = {
      target: new Decimal(row.targetPct).toNumber(),
      min: new Decimal(row.minPct).toNumber(),
      max: new Decimal(row.maxPct).toNumber(),
    };
  }
  return {
    config_version_id: input.config.configVersionId,
    risk_profile_type: input.config.riskProfileType,
    risk_score: input.config.riskScore,
    base_currency: input.config.baseCurrencyCode,
    target_allocations,
    concentration_limits: parseConcentrationLimitsForAnalytics({ config: input.config }),
  };
}

/**
 * Maps an asset into a portfolio-config asset-class bucket for allocation drift rules.
 */
export function resolveAssetAllocationBucket(input: { readonly asset: AssetRecord; readonly targetRows: readonly TargetRow[] }): string {
  const classes: readonly string[] = input.targetRows.map((r) => r.assetClass);
  if (classes.includes('UNCLASSIFIED')) {
    return 'UNCLASSIFIED';
  }
  if (input.asset.assetType === 'STOCK' || input.asset.assetType === 'ETF') {
    const equityKey: string | undefined = classes.find((c) => c === 'EQUITIES' || c === 'EQUITY' || c === 'STOCK_ETF');
    if (equityKey !== undefined) {
      return equityKey;
    }
  }
  if (isCryptoAsset({ asset: input.asset })) {
    const cryptoKey: string | undefined = classes.find((c) => c === 'CRYPTO');
    if (cryptoKey !== undefined) {
      return cryptoKey;
    }
  }
  if (classes.length > 0) {
    return classes[0] ?? 'UNCLASSIFIED';
  }
  return 'UNCLASSIFIED';
}

export function isCryptoAsset(input: { readonly asset: AssetRecord }): boolean {
  const sym: string = input.asset.symbol.trim().toUpperCase();
  if (sym === 'BTC' || sym === 'ETH' || sym === 'WBTC') {
    return true;
  }
  const name: string = input.asset.name.toLowerCase();
  return name.includes('bitcoin') || name.includes('ethereum') || name.includes('crypto');
}
