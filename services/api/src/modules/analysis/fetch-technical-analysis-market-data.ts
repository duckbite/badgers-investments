import YahooFinance from 'yahoo-finance2';
import { AnalysisComputationError } from './analysis-computation-error.js';

export type OhlcvBar = {
  readonly dateIso: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly adjClose: number;
  readonly volume: number;
};

export type YahooQuoteSnapshot = {
  readonly regularMarketPrice: number;
  readonly fiftyTwoWeekHigh: number;
  readonly fiftyTwoWeekLow: number;
  readonly regularMarketVolume: number;
  readonly currency: string;
};

type YahooFinanceClient = InstanceType<typeof YahooFinance>;

let yahooFinanceClient: YahooFinanceClient | undefined;

function getYahooFinance(): YahooFinanceClient {
  if (yahooFinanceClient === undefined) {
    yahooFinanceClient = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooFinanceClient;
}

function toBar(row: Record<string, unknown>): OhlcvBar | undefined {
  const dateRaw: unknown = row['date'];
  const open: unknown = row['open'];
  const high: unknown = row['high'];
  const low: unknown = row['low'];
  const close: unknown = row['close'];
  const adjClose: unknown = row['adjClose'];
  const volume: unknown = row['volume'];
  if (
    !(dateRaw instanceof Date) ||
    typeof open !== 'number' ||
    typeof high !== 'number' ||
    typeof low !== 'number' ||
    typeof close !== 'number' ||
    typeof volume !== 'number'
  ) {
    return undefined;
  }
  const adj: number = typeof adjClose === 'number' && Number.isFinite(adjClose) ? adjClose : close;
  return {
    dateIso: dateRaw.toISOString(),
    open,
    high,
    low,
    close,
    adjClose: adj,
    volume,
  };
}

function sortBarsAsc(bars: readonly OhlcvBar[]): OhlcvBar[] {
  return [...bars].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

const MIN_DAILY_BARS: number = 252;
const MIN_WEEKLY_BARS: number = 52;
const MIN_MONTHLY_BARS: number = 24;

/**
 * Loads daily / weekly / monthly OHLCV (adjusted close for splits) and a quote snapshot.
 * Uses Yahoo Finance per ADR-014. Throws {@link AnalysisComputationError} if minimum history is missing.
 */
export async function fetchTechnicalAnalysisMarketData(input: {
  readonly symbol: string;
  readonly now: Date;
}): Promise<{
  readonly daily: readonly OhlcvBar[];
  readonly weekly: readonly OhlcvBar[];
  readonly monthly: readonly OhlcvBar[];
  readonly quote: YahooQuoteSnapshot;
}> {
  const symbol: string = input.symbol.trim().toUpperCase();
  const yf: YahooFinanceClient = getYahooFinance();
  const period2: Date = input.now;
  const period1Daily: Date = new Date(input.now.getTime() - 800 * 24 * 60 * 60 * 1000);
  const period1Weekly: Date = new Date(input.now.getTime() - 800 * 24 * 60 * 60 * 1000);
  const period1Monthly: Date = new Date(input.now.getTime() - 3650 * 24 * 60 * 60 * 1000);

  let dailyRaw: unknown;
  let weeklyRaw: unknown;
  let monthlyRaw: unknown;
  try {
    dailyRaw = await yf.historical(symbol, {
      period1: period1Daily,
      period2,
      interval: '1d',
    });
    weeklyRaw = await yf.historical(symbol, {
      period1: period1Weekly,
      period2,
      interval: '1wk',
    });
    monthlyRaw = await yf.historical(symbol, {
      period1: period1Monthly,
      period2,
      interval: '1mo',
    });
  } catch (err: unknown) {
    const message: string = err instanceof Error ? err.message : String(err);
    throw new AnalysisComputationError(`Yahoo historical fetch failed for ${symbol}: ${message}`);
  }

  const daily: OhlcvBar[] = sortBarsAsc(
    (Array.isArray(dailyRaw) ? dailyRaw : [])
      .map((r) => (typeof r === 'object' && r !== null ? toBar(r as Record<string, unknown>) : undefined))
      .filter((b): b is OhlcvBar => b !== undefined),
  );
  const weekly: OhlcvBar[] = sortBarsAsc(
    (Array.isArray(weeklyRaw) ? weeklyRaw : [])
      .map((r) => (typeof r === 'object' && r !== null ? toBar(r as Record<string, unknown>) : undefined))
      .filter((b): b is OhlcvBar => b !== undefined),
  );
  const monthly: OhlcvBar[] = sortBarsAsc(
    (Array.isArray(monthlyRaw) ? monthlyRaw : [])
      .map((r) => (typeof r === 'object' && r !== null ? toBar(r as Record<string, unknown>) : undefined))
      .filter((b): b is OhlcvBar => b !== undefined),
  );

  if (daily.length < MIN_DAILY_BARS) {
    throw new AnalysisComputationError(
      `Insufficient daily history for ${symbol}: need at least ${MIN_DAILY_BARS} sessions, got ${daily.length}.`,
    );
  }
  if (weekly.length < MIN_WEEKLY_BARS) {
    throw new AnalysisComputationError(
      `Insufficient weekly history for ${symbol}: need at least ${MIN_WEEKLY_BARS} weeks, got ${weekly.length}.`,
    );
  }
  if (monthly.length < MIN_MONTHLY_BARS) {
    throw new AnalysisComputationError(
      `Insufficient monthly history for ${symbol}: need at least ${MIN_MONTHLY_BARS} months, got ${monthly.length}.`,
    );
  }

  let quoteRaw: unknown;
  try {
    quoteRaw = await yf.quote(symbol);
  } catch (err: unknown) {
    const message: string = err instanceof Error ? err.message : String(err);
    throw new AnalysisComputationError(`Yahoo quote failed for ${symbol}: ${message}`);
  }
  const qRow: unknown = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
  if (typeof qRow !== 'object' || qRow === null) {
    throw new AnalysisComputationError(`Yahoo quote returned no data for ${symbol}.`);
  }
  const qr: Record<string, unknown> = qRow as Record<string, unknown>;
  const lastDailyAdj: number = daily[daily.length - 1]?.adjClose ?? Number.NaN;
  const regularMarketPrice: number =
    typeof qr['regularMarketPrice'] === 'number' && Number.isFinite(qr['regularMarketPrice'])
      ? (qr['regularMarketPrice'] as number)
      : lastDailyAdj;
  const fiftyTwoWeekHigh: number =
    typeof qr['fiftyTwoWeekHigh'] === 'number' && Number.isFinite(qr['fiftyTwoWeekHigh'])
      ? (qr['fiftyTwoWeekHigh'] as number)
      : Number.NaN;
  const fiftyTwoWeekLow: number =
    typeof qr['fiftyTwoWeekLow'] === 'number' && Number.isFinite(qr['fiftyTwoWeekLow'])
      ? (qr['fiftyTwoWeekLow'] as number)
      : Number.NaN;
  const regularMarketVolume: number =
    typeof qr['regularMarketVolume'] === 'number' && Number.isFinite(qr['regularMarketVolume'])
      ? (qr['regularMarketVolume'] as number)
      : daily[daily.length - 1]?.volume ?? Number.NaN;
  const currency: string = typeof qr['currency'] === 'string' ? qr['currency'] : 'USD';

  if (!Number.isFinite(regularMarketPrice) || !Number.isFinite(fiftyTwoWeekHigh) || !Number.isFinite(fiftyTwoWeekLow)) {
    throw new AnalysisComputationError(`Yahoo quote missing price or 52w range fields for ${symbol}.`);
  }
  if (!Number.isFinite(regularMarketVolume)) {
    throw new AnalysisComputationError(`Yahoo quote missing volume for ${symbol}.`);
  }

  const quote: YahooQuoteSnapshot = {
    regularMarketPrice,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    regularMarketVolume,
    currency,
  };
  return { daily, weekly, monthly, quote };
}
