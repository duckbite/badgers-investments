/** Must stay aligned with `services/api/src/modules/domain/currency-codes.ts`. */
export const ALLOWED_CURRENCY_CODES: readonly string[] = [
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
] as const;
