import YahooFinance from 'yahoo-finance2';

type YahooFinanceClient = InstanceType<typeof YahooFinance>;

let yahooFinanceClient: YahooFinanceClient | undefined;

function getYahooFinance(): YahooFinanceClient {
  if (yahooFinanceClient === undefined) {
    yahooFinanceClient = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooFinanceClient;
}

/**
 * Resolves a human-readable issuer name for a listed symbol (longName / shortName from Yahoo quote).
 * On failure, returns the uppercase symbol so callers can still build "Name (TICKER)" copy.
 */
export async function fetchYahooInstrumentDisplayName(input: { readonly symbol: string }): Promise<string> {
  const symbolUpper: string = input.symbol.trim().toUpperCase();
  if (symbolUpper.length === 0) {
    return 'Unknown';
  }
  try {
    const yf: YahooFinanceClient = getYahooFinance();
    const quote: unknown = await yf.quote(symbolUpper);
    const row: unknown = Array.isArray(quote) ? quote[0] : quote;
    if (typeof row !== 'object' || row === null) {
      return symbolUpper;
    }
    const rec: Record<string, unknown> = row as Record<string, unknown>;
    const longName: unknown = rec['longName'];
    const shortName: unknown = rec['shortName'];
    if (typeof longName === 'string' && longName.trim().length > 0) {
      return longName.trim();
    }
    if (typeof shortName === 'string' && shortName.trim().length > 0) {
      return shortName.trim();
    }
  } catch {
    return symbolUpper;
  }
  return symbolUpper;
}
