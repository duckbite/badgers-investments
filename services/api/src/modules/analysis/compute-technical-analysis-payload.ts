import type { YahooQuoteSnapshot } from './fetch-technical-analysis-market-data.js';

export type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';

export type TechnicalAnalysisComputationPayload = {
  readonly meta: {
    readonly symbol: string;
    readonly computedAtIso: string;
    readonly currentPriceDefinition: 'yahoo_regular_market_price_else_last_daily_adj_close';
  };
  readonly quote: YahooQuoteSnapshot;
  readonly seriesLengths: { readonly daily: number; readonly weekly: number; readonly monthly: number };
  readonly movingAverages: {
    readonly sma50: readonly number[];
    readonly sma100: readonly number[];
    readonly sma200: readonly number[];
    readonly sma50SlopeLabel: 'rising' | 'flat' | 'falling';
    readonly sma100SlopeLabel: 'rising' | 'flat' | 'falling';
    readonly sma200SlopeLabel: 'rising' | 'flat' | 'falling';
    readonly goldenCrossInLast20Sessions: boolean;
    readonly deathCrossInLast20Sessions: boolean;
  };
  readonly rsi14: { readonly last6: readonly number[] };
  readonly macd: {
    readonly last5Macd: readonly number[];
    readonly last5Signal: readonly number[];
    readonly last5Histogram: readonly number[];
    readonly signalCrossoverBullishLast5: boolean;
    readonly signalCrossoverBearishLast5: boolean;
  };
  readonly bollinger: {
    readonly upper: number;
    readonly middle: number;
    readonly lower: number;
    readonly percentB: number;
    readonly bandwidthClassification: 'expanding' | 'contracting' | 'neutral';
  };
  readonly volume: {
    readonly avg20: number;
    readonly avgUpClose20: number;
    readonly avgDownClose20: number;
    readonly obvLast10: readonly number[];
    readonly latestVsAvg20: 'above' | 'below' | 'neutral';
  };
  readonly levels: {
    readonly resistanceUpTo3: readonly number[];
    readonly supportUpTo3: readonly number[];
    readonly fib: {
      readonly swingHigh: number;
      readonly swingLow: number;
      readonly levels236: number;
      readonly levels382: number;
      readonly levels500: number;
      readonly levels618: number;
      readonly levels786: number;
    };
  };
  readonly trend: {
    readonly daily: 'uptrend' | 'downtrend' | 'sideways';
    readonly weekly: 'uptrend' | 'downtrend' | 'sideways';
    readonly monthly: 'uptrend' | 'downtrend' | 'sideways';
  };
  readonly atr14: { readonly latest: number };
  /** Full daily adjusted closes (for bundle sparkline / reproducibility). */
  readonly reproduction: { readonly dailyAdjCloses: readonly number[] };
};
