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
