export const PRICE_PROVIDER_KEY_YAHOO_FINANCE: string = 'YAHOO_FINANCE';

/** Placeholder slot for a future crypto (or other) provider; not wired to external APIs yet. */
export const PRICE_PROVIDER_KEY_CRYPTO_AGGREGATE: string = 'CRYPTO_AGGREGATE';

const ALLOWED: ReadonlySet<string> = new Set<string>([
  PRICE_PROVIDER_KEY_YAHOO_FINANCE,
  PRICE_PROVIDER_KEY_CRYPTO_AGGREGATE,
]);

export function isAllowedPrimaryPriceProviderKey(input: { readonly raw: string }): boolean {
  return ALLOWED.has(input.raw);
}
