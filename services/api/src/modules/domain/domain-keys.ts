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

export const SNAPSHOT_STATE_SORT_KEY: string = 'SNAPSHOT_STATE';
