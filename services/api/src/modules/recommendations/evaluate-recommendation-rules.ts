import { randomUUID } from 'crypto';
import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';
import type { RuleFinding } from './recommendation-rule-types.js';
import { isCryptoAsset } from './parse-portfolio-config-for-analytics.js';
import type { AssetRecord } from '../assets/asset-repository.js';

function pushFinding(input: {
  readonly findings: RuleFinding[];
  readonly rule_code: string;
  readonly severity: RuleFinding['severity'];
  readonly scope: RuleFinding['scope'];
  readonly asset_id: string | null;
  readonly message: string;
  readonly metrics_json: Readonly<Record<string, unknown>>;
}): void {
  input.findings.push({
    findingId: randomUUID(),
    rule_code: input.rule_code,
    severity: input.severity,
    scope: input.scope,
    asset_id: input.asset_id,
    message: input.message,
    metrics_json: input.metrics_json,
  });
}

function actualPctForBucket(input: { readonly payload: RecommendationAnalyticsPayload; readonly bucket: string }): number {
  const row = input.payload.allocations.by_asset_type.find((r) => r.asset_type === input.bucket);
  return row?.pct_owned ?? 0;
}

/**
 * MVP rule catalogue per docs/recommendation-spec-v1.md §8 (cash-buffer rules omitted: cash is not tracked as an asset class yet).
 */
export function evaluateRecommendationRules(input: {
  readonly payload: RecommendationAnalyticsPayload;
  readonly adjustmentCountLast30Days: number;
  readonly assetsById: ReadonlyMap<string, AssetRecord>;
}): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const { payload } = input;
  const limits: Readonly<Record<string, number>> = payload.config.concentration_limits;
  const maxSingle: number | undefined = limits['max_single_asset_pct'];
  const maxCrypto: number | undefined = limits['max_crypto_pct'];
  const maxSector: number | undefined = limits['max_single_sector_pct'];
  const targetKeys: string[] = Object.keys(payload.config.target_allocations);
  if (targetKeys.length === 0) {
    pushFinding({
      findings,
      rule_code: 'R502',
      severity: 'HIGH',
      scope: 'PORTFOLIO',
      asset_id: null,
      message: 'Portfolio configuration has no target allocation rows.',
      metrics_json: {},
    });
  }
  for (const bucket of targetKeys) {
    const cfg = payload.config.target_allocations[bucket];
    if (cfg === undefined) {
      continue;
    }
    const actualPct: number = actualPctForBucket({ payload, bucket });
    if (actualPct < cfg.min) {
      pushFinding({
        findings,
        rule_code: 'R101',
        severity: 'WARN',
        scope: 'PORTFOLIO',
        asset_id: null,
        message: `Allocation for ${bucket} is below the configured minimum.`,
        metrics_json: { bucket, actual_pct: actualPct, min_pct: cfg.min, delta_pct: actualPct - cfg.min },
      });
    }
    if (actualPct > cfg.max) {
      const over: number = actualPct - cfg.max;
      pushFinding({
        findings,
        rule_code: 'R102',
        severity: over >= 5 ? 'HIGH' : 'WARN',
        scope: 'PORTFOLIO',
        asset_id: null,
        message: `Allocation for ${bucket} is above the configured maximum.`,
        metrics_json: { bucket, actual_pct: actualPct, max_pct: cfg.max, delta_pct: over },
      });
    }
    if (Math.abs(actualPct - cfg.target) >= 5) {
      pushFinding({
        findings,
        rule_code: 'R103',
        severity: 'INFO',
        scope: 'PORTFOLIO',
        asset_id: null,
        message: `Allocation for ${bucket} has drifted from target by at least 5 percentage points.`,
        metrics_json: { bucket, actual_pct: actualPct, target_pct: cfg.target },
      });
    }
  }
  const market: number = payload.quality.market_asset_count;
  const priced: number = payload.quality.priced_asset_count;
  if (market > 0 && priced / market < 0.8) {
    pushFinding({
      findings,
      rule_code: 'R003',
      severity: 'HIGH',
      scope: 'PORTFOLIO',
      asset_id: null,
      message: 'Fewer than 80% of market assets have usable price coverage for this snapshot.',
      metrics_json: { market_asset_count: market, priced_asset_count: priced, ratio: priced / market },
    });
  }
  for (const asset of payload.assets) {
    if (asset.allocation_pct < 5) {
      continue;
    }
    const hours: number | null = asset.price_freshness_hours;
    if (hours === null) {
      continue;
    }
    if (hours > 120) {
      pushFinding({
        findings,
        rule_code: 'R001',
        severity: 'HIGH',
        scope: 'ASSET',
        asset_id: asset.asset_id,
        message: `Price data for ${asset.symbol} is stale (${hours.toFixed(1)}h); recommendation confidence reduced.`,
        metrics_json: { price_freshness_hours: hours, allocation_pct: asset.allocation_pct },
      });
    } else if (hours > 48) {
      pushFinding({
        findings,
        rule_code: 'R001',
        severity: 'WARN',
        scope: 'ASSET',
        asset_id: asset.asset_id,
        message: `Price data for ${asset.symbol} is aging (${hours.toFixed(1)}h).`,
        metrics_json: { price_freshness_hours: hours, allocation_pct: asset.allocation_pct },
      });
    }
  }
  if (maxSingle !== undefined) {
    for (const asset of payload.assets) {
      if (asset.allocation_pct > maxSingle) {
        pushFinding({
          findings,
          rule_code: 'R201',
          severity: 'HIGH',
          scope: 'ASSET',
          asset_id: asset.asset_id,
          message: `${asset.symbol} exceeds the configured single-asset concentration limit.`,
          metrics_json: { asset_allocation_pct: asset.allocation_pct, max_single_asset_pct: maxSingle },
        });
      } else if (asset.allocation_pct >0.9 * maxSingle) {
        pushFinding({
          findings,
          rule_code: 'R202',
          severity: 'WARN',
          scope: 'ASSET',
          asset_id: asset.asset_id,
          message: `${asset.symbol} is approaching the single-asset concentration limit.`,
          metrics_json: { asset_allocation_pct: asset.allocation_pct, max_single_asset_pct: maxSingle },
        });
      }
    }
  }
  if (maxCrypto !== undefined) {
    let cryptoPct = 0;
    for (const a of payload.assets) {
      const rec: AssetRecord | undefined = input.assetsById.get(a.asset_id);
      if (rec !== undefined && isCryptoAsset({ asset: rec })) {
        cryptoPct += a.allocation_pct;
      }
    }
    if (cryptoPct > maxCrypto) {
      pushFinding({
        findings,
        rule_code: 'R203',
        severity: 'HIGH',
        scope: 'PORTFOLIO',
        asset_id: null,
        message: 'Crypto allocation exceeds the configured portfolio limit.',
        metrics_json: { crypto_pct: cryptoPct, max_crypto_pct: maxCrypto },
      });
    }
  }
  if (maxSector !== undefined) {
    const sectorToPct: Record<string, number> = {};
    for (const a of payload.assets) {
      const rec: AssetRecord | undefined = input.assetsById.get(a.asset_id);
      const sector: string = (rec?.sector ?? 'UNKNOWN').trim();
      if (sector.length === 0) {
        continue;
      }
      sectorToPct[sector] = (sectorToPct[sector] ?? 0) + a.allocation_pct;
    }
    for (const [sector, pct] of Object.entries(sectorToPct)) {
      if (pct > maxSector) {
        pushFinding({
          findings,
          rule_code: 'R204',
          severity: pct - maxSector >= 5 ? 'HIGH' : 'WARN',
          scope: 'PORTFOLIO',
          asset_id: null,
          message: `Sector ${sector} exceeds the configured concentration limit.`,
          metrics_json: { sector, sector_pct: pct, max_single_sector_pct: maxSector },
        });
      }
    }
  }
  for (const asset of payload.assets) {
    if (asset.allocation_pct <= 15 || asset.cost_basis <= 0) {
      continue;
    }
    const gainPct: number = (asset.unrealised_pnl / asset.cost_basis) * 100;
    if (gainPct > 25) {
      pushFinding({
        findings,
        rule_code: 'R401',
        severity: 'INFO',
        scope: 'ASSET',
        asset_id: asset.asset_id,
        message: `${asset.symbol} has a large unrealised gain relative to cost basis; consider review.`,
        metrics_json: { unrealised_gain_pct: gainPct, allocation_pct: asset.allocation_pct },
      });
    }
  }
  for (const asset of payload.assets) {
    if (asset.allocation_pct <= 5 || asset.cost_basis <= 0) {
      continue;
    }
    const lossPct: number = (asset.unrealised_pnl / asset.cost_basis) * 100;
    if (lossPct < -20) {
      pushFinding({
        findings,
        rule_code: 'R402',
        severity: 'WARN',
        scope: 'ASSET',
        asset_id: asset.asset_id,
        message: `${asset.symbol} shows a material unrealised loss; review thesis and risk.`,
        metrics_json: { unrealised_loss_pct: lossPct, allocation_pct: asset.allocation_pct },
      });
    }
  }
  const twr1m: number | null = payload.portfolio.twr['1m'];
  const twr3m: number | null = payload.portfolio.twr['3m'];
  if (twr1m !== null && twr1m < 0) {
    pushFinding({
      findings,
      rule_code: 'R403',
      severity: 'INFO',
      scope: 'PORTFOLIO',
      asset_id: null,
      message: 'Portfolio 1-month TWR is negative.',
      metrics_json: { twr_1m: twr1m },
    });
  }
  if (twr3m !== null && twr3m < -0.05) {
    pushFinding({
      findings,
      rule_code: 'R403',
      severity: 'WARN',
      scope: 'PORTFOLIO',
      asset_id: null,
      message: 'Portfolio 3-month TWR is materially negative.',
      metrics_json: { twr_3m: twr3m },
    });
  }
  if (input.adjustmentCountLast30Days > 3) {
    pushFinding({
      findings,
      rule_code: 'R501',
      severity: 'INFO',
      scope: 'PORTFOLIO',
      asset_id: null,
      message: 'More than three ledger adjustments in the last 30 days may reduce confidence in derived metrics.',
      metrics_json: { adjustment_count_30d: input.adjustmentCountLast30Days },
    });
  }
  return findings;
}
