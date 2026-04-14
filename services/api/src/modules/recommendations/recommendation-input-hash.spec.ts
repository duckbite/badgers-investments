import { describe, expect, it } from 'vitest';
import { computeRecommendationAnalyticsInputHash } from './recommendation-input-hash.js';
import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';

function buildPayload(input: { readonly total: number }): RecommendationAnalyticsPayload {
  return {
    analytics_schema_version: '1.0',
    snapshot_date: '2026-04-01',
    portfolio: {
      portfolio_id: 'p1',
      base_currency: 'USD',
      as_of_timestamp: '2026-04-01T23:59:59.999Z',
      valuation_timestamp: '2026-04-01T23:59:59.999Z',
      total_value_owned: input.total,
      total_value_full: input.total,
      cash_value_owned: 0,
      realised_pnl_total: 0,
      unrealised_pnl_total: 0,
      twr: { '1m': null, '3m': null, ytd: null, '1y': null, all: null, calculation_method: 'TWR_DAILY_V1' },
    },
    config: {
      config_version_id: 'cv1',
      risk_profile_type: 'BALANCED',
      risk_score: 5,
      base_currency: 'USD',
      target_allocations: { UNCLASSIFIED: { target: 100, min: 0, max: 100 } },
      concentration_limits: {},
    },
    allocations: { by_asset_type: [], top_holdings: [] },
    assets: [],
    quality: {
      asset_count: 0,
      market_asset_count: 0,
      priced_asset_count: 0,
      stale_price_asset_count: 0,
      manual_valuation_asset_count: 0,
      stale_manual_valuation_count: 0,
      warnings: [],
    },
  };
}

describe('computeRecommendationAnalyticsInputHash', () => {
  it('matches for identical payloads and config version', () => {
    const payload: RecommendationAnalyticsPayload = buildPayload({ total: 1000 });
    const a: string = computeRecommendationAnalyticsInputHash({ configVersionId: 'cv1', analyticsPayload: payload });
    const b: string = computeRecommendationAnalyticsInputHash({ configVersionId: 'cv1', analyticsPayload: buildPayload({ total: 1000 }) });
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });
  it('changes when a material metric changes', () => {
    const a: string = computeRecommendationAnalyticsInputHash({
      configVersionId: 'cv1',
      analyticsPayload: buildPayload({ total: 1000 }),
    });
    const b: string = computeRecommendationAnalyticsInputHash({
      configVersionId: 'cv1',
      analyticsPayload: buildPayload({ total: 1001 }),
    });
    expect(a).not.toBe(b);
  });
});
