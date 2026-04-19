/**
 * Tail-aligned OHLCV + indicator series for deterministic chart SVGs (not sent to the LLM).
 */
export type TechnicalAnalysisBundleChartContext = {
  readonly symbol: string;
  readonly tailLength: number;
  readonly closes: readonly number[];
  readonly opens: readonly number[];
  readonly highs: readonly number[];
  readonly lows: readonly number[];
  readonly volumes: readonly number[];
  readonly macdLine: readonly number[];
  readonly macdSignal: readonly number[];
  readonly macdHistogram: readonly number[];
  readonly rsi: readonly number[];
  readonly bbUpper: readonly number[];
  readonly bbMiddle: readonly number[];
  readonly bbLower: readonly number[];
  readonly obv: readonly number[];
  readonly sma50: readonly number[];
  readonly sma100: readonly number[];
  readonly sma200: readonly number[];
  readonly atr: readonly number[];
};

export const BUNDLE_CHART_TAIL_BARS: number = 120;
