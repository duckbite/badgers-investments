const ALLOWED_CURRENCY_CODES: ReadonlySet<string> = new Set([
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'CNY',
  'CHF',
  'AUD',
  'CAD',
  'HKD',
  'NZD',
]);

export function isAllowedCurrencyCode(input: { readonly raw: string }): boolean {
  return ALLOWED_CURRENCY_CODES.has(input.raw.trim().toUpperCase());
}

export function normalizeCurrencyCode(input: { readonly raw: string }): string {
  return input.raw.trim().toUpperCase();
}
