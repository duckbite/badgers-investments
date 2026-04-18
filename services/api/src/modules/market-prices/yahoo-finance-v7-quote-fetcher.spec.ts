import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuote } = vi.hoisted(() => ({
  mockQuote: vi.fn(),
}));

vi.mock('yahoo-finance2', () => ({
  default: class YahooFinanceMock {
    public quote = mockQuote;
  },
}));

import { fetchYahooFinanceV7Quotes } from './yahoo-finance-v7-quote-fetcher.js';

describe('fetchYahooFinanceV7Quotes', () => {
  beforeEach(() => {
    mockQuote.mockReset();
  });

  it('maps yahoo-finance2 quote results into snapshot-ready rows', async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        regularMarketPrice: 180.12,
        currency: 'USD',
        regularMarketTime: 1_704_000_000,
      },
    ]);
    const rows = await fetchYahooFinanceV7Quotes({ symbols: ['AAPL'], now: new Date('2024-01-02T12:00:00.000Z') });
    expect(mockQuote).toHaveBeenCalledWith(['AAPL'], {
      fields: ['symbol', 'regularMarketPrice', 'currency', 'regularMarketTime'],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe('AAPL');
    expect(rows[0]?.price).toBe('180.12');
    expect(rows[0]?.currencyCode).toBe('USD');
    expect(rows[0]?.rawPayloadHash.length).toBeGreaterThan(0);
  });

  it('accepts regularMarketTime as ISO string (yahoo-finance2 shape)', async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        regularMarketPrice: 100,
        currency: 'USD',
        regularMarketTime: '2024-06-01T16:00:00.000Z',
      },
    ]);
    const rows = await fetchYahooFinanceV7Quotes({ symbols: ['AAPL'], now: new Date('2024-01-02T12:00:00.000Z') });
    expect(rows[0]?.priceTimestampIso).toBe('2024-06-01T16:00:00.000Z');
    expect(rows[0]?.priceDate).toBe('2024-06-01');
  });
});
