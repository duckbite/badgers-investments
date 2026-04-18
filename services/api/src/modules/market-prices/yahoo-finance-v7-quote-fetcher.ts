import { createHash } from 'node:crypto';
import YahooFinance from 'yahoo-finance2';

type YahooFinanceClient = InstanceType<typeof YahooFinance>;

export type YahooFinanceQuoteRow = {
  readonly symbol: string;
  readonly price: string;
  readonly currencyCode: string;
  readonly priceDate: string;
  readonly priceTimestampIso: string;
  readonly dataQuality: string;
  readonly rawPayloadHash: string;
};

const BATCH_SIZE: number = 12;
const BETWEEN_BATCH_DELAY_MS: number = 750;

/** Reused so Yahoo session cookies / crumb state can persist across batches. */
let yahooFinanceClient: YahooFinanceClient | undefined;

function getYahooFinance(): YahooFinanceClient {
  if (yahooFinanceClient === undefined) {
    yahooFinanceClient = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooFinanceClient;
}

/**
 * Fetches delayed/regular market quotes via **yahoo-finance2** (handles Yahoo cookie + crumb flow).
 * Raw `v7/finance/quote` requests often return **401** with `finance.error` (“User is unable to access this feature”).
 * Batches symbols (12 per request), waits 750ms between batches, retries once per batch on failure.
 */
export async function fetchYahooFinanceV7Quotes(input: {
  readonly symbols: readonly string[];
  readonly now: Date;
}): Promise<readonly YahooFinanceQuoteRow[]> {
  const unique: string[] = Array.from(new Set(input.symbols.map((s) => s.trim()).filter((s) => s.length > 0)));
  const results: YahooFinanceQuoteRow[] = [];
  const yf: YahooFinanceClient = getYahooFinance();
  for (let i: number = 0; i < unique.length; i += BATCH_SIZE) {
    const batch: string[] = unique.slice(i, i + BATCH_SIZE);
    const batchRows: YahooFinanceQuoteRow[] = await fetchQuoteBatchWithRetry({ yf, symbols: batch, now: input.now });
    results.push(...batchRows);
    if (i + BATCH_SIZE < unique.length) {
      await delay({ ms: BETWEEN_BATCH_DELAY_MS });
    }
  }
  return results;
}

async function fetchQuoteBatchWithRetry(input: {
  readonly yf: YahooFinanceClient;
  readonly symbols: readonly string[];
  readonly now: Date;
}): Promise<YahooFinanceQuoteRow[]> {
  try {
    return await fetchQuoteBatch(input);
  } catch {
    await delay({ ms: 1200 });
    return await fetchQuoteBatch(input);
  }
}

async function fetchQuoteBatch(input: {
  readonly yf: YahooFinanceClient;
  readonly symbols: readonly string[];
  readonly now: Date;
}): Promise<YahooFinanceQuoteRow[]> {
  let quotes: unknown;
  try {
    quotes = await input.yf.quote([...input.symbols], {
      fields: ['symbol', 'regularMarketPrice', 'currency', 'regularMarketTime'],
    });
  } catch (err: unknown) {
    const message: string = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Yahoo quote failed (yahoo-finance2). Yahoo may block datacenter IPs or require session refresh: ${message}`,
    );
  }
  if (!Array.isArray(quotes)) {
    throw new Error('Yahoo quote: expected an array of quotes from yahoo-finance2');
  }
  const rows: YahooFinanceQuoteRow[] = [];
  for (const item of quotes) {
    const row: YahooFinanceQuoteRow | undefined = mapQuoteToRow({ item, fallbackNow: input.now });
    if (row !== undefined) {
      rows.push(row);
    }
  }
  return rows;
}

function mapQuoteToRow(input: { readonly item: unknown; readonly fallbackNow: Date }): YahooFinanceQuoteRow | undefined {
  if (typeof input.item !== 'object' || input.item === null) {
    return undefined;
  }
  const rec: Record<string, unknown> = input.item as Record<string, unknown>;
  const symbol: unknown = rec['symbol'];
  const priceRaw: unknown = rec['regularMarketPrice'];
  const currency: unknown = rec['currency'];
  const marketTime: unknown = rec['regularMarketTime'];
  if (typeof symbol !== 'string' || typeof priceRaw !== 'number' || !Number.isFinite(priceRaw) || priceRaw <= 0) {
    return undefined;
  }
  const currencyCode: string = typeof currency === 'string' && currency.length > 0 ? currency : 'USD';
  const tsSeconds: number = resolveRegularMarketTimeSeconds({ marketTime, fallbackNow: input.fallbackNow });
  const priceTimestampIso: string = new Date(tsSeconds * 1000).toISOString();
  const priceDate: string = priceTimestampIso.slice(0, 10);
  const price: string = String(priceRaw);
  const dataQuality: string = 'YAHOO_FINANCE_V7_REGULAR_MARKET';
  const rawJson: string = JSON.stringify(input.item);
  const rawPayloadHash: string = createHash('sha256').update(rawJson).digest('hex').slice(0, 24);
  return {
    symbol,
    price,
    currencyCode,
    priceDate,
    priceTimestampIso,
    dataQuality,
    rawPayloadHash,
  };
}

function resolveRegularMarketTimeSeconds(input: { readonly marketTime: unknown; readonly fallbackNow: Date }): number {
  const { marketTime, fallbackNow } = input;
  if (typeof marketTime === 'number' && Number.isFinite(marketTime)) {
    return marketTime;
  }
  if (typeof marketTime === 'string' && marketTime.length > 0) {
    const ms: number = Date.parse(marketTime);
    if (Number.isFinite(ms)) {
      return Math.floor(ms / 1000);
    }
  }
  return Math.floor(fallbackNow.getTime() / 1000);
}

function delay(input: { readonly ms: number }): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, input.ms);
  });
}
