const USER_PREFIX: string = 'USER#';
const PORTFOLIO_PREFIX: string = 'PORTFOLIO#';
const PF_SEGMENT: string = '#PF#';
const ASSET_PREFIX: string = 'ASSET#';
const TXN_PREFIX: string = 'TXN#';
const LOTLINK_PREFIX: string = 'LOTLINK#';

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
