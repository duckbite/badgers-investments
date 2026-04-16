const USER_PREFIX: string = 'USER#';
const PORTFOLIO_PREFIX: string = 'PORTFOLIO#';
const PF_SEGMENT: string = '#PF#';
const ASSET_PREFIX: string = 'ASSET#';
const TXN_PREFIX: string = 'TXN#';
const LOTLINK_PREFIX: string = 'LOTLINK#';
const PRICE_PREFIX: string = 'PRICE#';
const POS_SNAP_PREFIX: string = 'POS_SNAP#';
const PORT_SNAP_PREFIX: string = 'PORT_SNAP#';
const PERF_SNAP_PREFIX: string = 'PERF_SNAP#';
const PORTFOLIO_CFG_VERSION_PREFIX: string = 'PORTFOLIO_CFG#V';

export const PORTFOLIO_CONFIG_ACTIVE_SORT_KEY: string = 'PORTFOLIO_CFG#ACTIVE';

export function buildUserPartitionKey(input: { readonly userId: string }): string {
  return `${USER_PREFIX}${input.userId}`;
}

export function buildPortfolioSortKey(input: { readonly portfolioId: string }): string {
  return `${PORTFOLIO_PREFIX}${input.portfolioId}`;
}

export function buildPortfolioScopedPartitionKey(input: { readonly userId: string; readonly portfolioId: string }): string {
  return `${USER_PREFIX}${input.userId}${PF_SEGMENT}${input.portfolioId}`;
}

export function buildAssetSortKey(input: { readonly assetId: string }): string {
  return `${ASSET_PREFIX}${input.assetId}`;
}

export function buildTransactionSortKey(input: { readonly transactionId: string }): string {
  return `${TXN_PREFIX}${input.transactionId}`;
}

export function buildLotLinkSortKey(input: { readonly sellTransactionId: string; readonly linkId: string }): string {
  return `${LOTLINK_PREFIX}${input.sellTransactionId}#${input.linkId}`;
}

export function buildPriceSortKey(input: {
  readonly assetId: string;
  readonly priceTimestampIso: string;
  readonly priceSnapshotId: string;
}): string {
  return `${PRICE_PREFIX}${input.assetId}#${input.priceTimestampIso}#${input.priceSnapshotId}`;
}

export function buildPriceSortKeyPrefixForAsset(input: { readonly assetId: string }): string {
  return `${PRICE_PREFIX}${input.assetId}#`;
}

export function buildPositionSnapshotSortKey(input: { readonly snapshotDate: string; readonly assetId: string }): string {
  return `${POS_SNAP_PREFIX}${input.snapshotDate}#${input.assetId}`;
}

export function buildPortfolioSnapshotSortKey(input: { readonly snapshotDate: string }): string {
  return `${PORT_SNAP_PREFIX}${input.snapshotDate}`;
}

export function buildPerformanceSnapshotSortKey(input: { readonly periodDate: string }): string {
  return `${PERF_SNAP_PREFIX}${input.periodDate}`;
}

/**
 * Sortable version rows for `portfolio_config_version` (unique per portfolio via padded `versionNumber`).
 */
export function buildPortfolioConfigVersionSortKey(input: { readonly versionNumber: number }): string {
  const padded: string = String(input.versionNumber).padStart(8, '0');
  return `${PORTFOLIO_CFG_VERSION_PREFIX}${padded}`;
}

export function buildPortfolioConfigVersionSortKeyPrefix(): string {
  return PORTFOLIO_CFG_VERSION_PREFIX;
}

export const SNAPSHOT_STATE_SORT_KEY: string = 'SNAPSHOT_STATE';

/** Per-user AI provider credentials for recommendation runs (encrypted at rest). */
export const USER_SETTINGS_AI_SORT_KEY: string = 'USER_SETTINGS#AI';

/** Per-user privacy settings (e.g. amount-reveal PIN hash). */
export const USER_SETTINGS_PRIVACY_SORT_KEY: string = 'USER_SETTINGS#PRIVACY';

const REC_RUN_PREFIX: string = 'REC_RUN#';
const REC_FINDING_PREFIX: string = 'REC_FIND#';
const REC_ITEM_PREFIX: string = 'REC_ITEM#';

/**
 * Recommendation run header row (portfolio-scoped PK). SK orders runs by start time for listing.
 */
export function buildRecommendationRunSortKey(input: { readonly startedAtIso: string; readonly runId: string }): string {
  return `${REC_RUN_PREFIX}${input.startedAtIso}#${input.runId}`;
}

export function buildRecommendationFindingSortKey(input: { readonly runId: string; readonly findingId: string }): string {
  return `${REC_FINDING_PREFIX}${input.runId}#${input.findingId}`;
}

export function buildRecommendationItemSortKey(input: { readonly runId: string; readonly itemId: string }): string {
  return `${REC_ITEM_PREFIX}${input.runId}#${input.itemId}`;
}

export function buildRecommendationRunSortKeyPrefix(): string {
  return REC_RUN_PREFIX;
}

/** Global queue partition for async recommendation jobs (MVP: Query by PK). */
export const RECOMMENDATION_JOB_QUEUE_PARTITION_KEY: string = 'RECOMMENDATION_JOB_QUEUE';

const REC_JOB_PREFIX: string = 'REC_JOB#';
const ANALYSIS_RUN_PREFIX: string = 'ANALYSIS_RUN#';
const ANALYSIS_REPORT_PREFIX: string = 'ANALYSIS_REPORT#';

export function buildRecommendationJobQueueSortKey(input: { readonly enqueuedAtIso: string; readonly runId: string }): string {
  return `${REC_JOB_PREFIX}${input.enqueuedAtIso}#${input.runId}`;
}

export function buildAnalysisRunSortKey(input: { readonly createdAtIso: string; readonly runId: string }): string {
  return `${ANALYSIS_RUN_PREFIX}${input.createdAtIso}#${input.runId}`;
}

export function buildAnalysisRunSortKeyPrefix(): string {
  return ANALYSIS_RUN_PREFIX;
}

export function buildAnalysisReportSortKey(input: { readonly createdAtIso: string; readonly reportId: string }): string {
  return `${ANALYSIS_REPORT_PREFIX}${input.createdAtIso}#${input.reportId}`;
}

export function buildAnalysisReportSortKeyPrefix(): string {
  return ANALYSIS_REPORT_PREFIX;
}
