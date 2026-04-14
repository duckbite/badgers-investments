export type RecommendationAnalyticsTwrBlock = {
  readonly '1m': number | null;
  readonly '3m': number | null;
  readonly ytd: number | null;
  readonly '1y': number | null;
  readonly all: number | null;
  readonly calculation_method: string;
};

export type RecommendationAnalyticsPortfolio = {
  readonly portfolio_id: string;
  readonly base_currency: string;
  readonly as_of_timestamp: string;
  readonly valuation_timestamp: string;
  readonly total_value_owned: number;
  readonly total_value_full: number;
  readonly cash_value_owned: number;
  readonly realised_pnl_total: number;
  readonly unrealised_pnl_total: number;
  readonly twr: RecommendationAnalyticsTwrBlock;
};

export type RecommendationAnalyticsConfigBucket = {
  readonly target: number;
  readonly min: number;
  readonly max: number;
};

export type RecommendationAnalyticsConfig = {
  readonly config_version_id: string;
  readonly risk_profile_type: string;
  readonly risk_score: number | null;
  readonly base_currency: string;
  readonly target_allocations: Readonly<Record<string, RecommendationAnalyticsConfigBucket>>;
  readonly concentration_limits: Readonly<Record<string, number>>;
};

export type RecommendationAnalyticsAllocationByType = {
  readonly asset_type: string;
  readonly value_owned: number;
  readonly pct_owned: number;
};

export type RecommendationAnalyticsTopHolding = {
  readonly asset_id: string;
  readonly name: string;
  readonly symbol: string;
  readonly asset_type: string;
  readonly sector: string | null;
  readonly value_owned: number;
  readonly allocation_pct: number;
  readonly unrealised_pnl: number;
  readonly price_freshness_hours: number | null;
};

export type RecommendationAnalyticsAsset = {
  readonly asset_id: string;
  readonly name: string;
  readonly symbol: string;
  readonly asset_type: string;
  readonly currency: string;
  readonly ownership_pct: number;
  readonly quantity_held: number;
  readonly current_price: number | null;
  readonly current_value_owned: number;
  readonly cost_basis: number;
  readonly unrealised_pnl: number;
  readonly realised_pnl_cumulative: number;
  readonly allocation_pct: number;
  readonly price_freshness_hours: number | null;
  readonly has_stale_price: boolean;
  readonly trend_signals: { readonly enabled: boolean };
};

export type RecommendationAnalyticsQuality = {
  readonly asset_count: number;
  readonly market_asset_count: number;
  readonly priced_asset_count: number;
  readonly stale_price_asset_count: number;
  readonly manual_valuation_asset_count: number;
  readonly stale_manual_valuation_count: number;
  readonly warnings: readonly string[];
};

export type RecommendationAnalyticsPayload = {
  readonly analytics_schema_version: string;
  readonly snapshot_date: string;
  readonly portfolio: RecommendationAnalyticsPortfolio;
  readonly config: RecommendationAnalyticsConfig;
  readonly allocations: {
    readonly by_asset_type: readonly RecommendationAnalyticsAllocationByType[];
    readonly top_holdings: readonly RecommendationAnalyticsTopHolding[];
  };
  readonly assets: readonly RecommendationAnalyticsAsset[];
  readonly quality: RecommendationAnalyticsQuality;
};
