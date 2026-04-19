import { atr, bollingerbands, macd, obv, rsi, sma } from 'technicalindicators';
import type { OhlcvBar, YahooQuoteSnapshot } from './fetch-technical-analysis-market-data.js';
import { fetchTechnicalAnalysisMarketData } from './fetch-technical-analysis-market-data.js';
import { AnalysisComputationError } from './analysis-computation-error.js';
import {
  collectFractalPivotHighs,
  collectFractalPivotLows,
  selectFibonacciSwingFromFractals,
} from './fractal-pivots.js';
import type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';
import { BUNDLE_CHART_TAIL_BARS } from './bundle-chart-context.js';
import {
  BOLLINGER_BW_NEUTRAL_TOLERANCE,
  PIVOT_SWING_WINDOW_K,
  SMA_SLOPE_FLAT_THRESHOLD,
  TREND_MIN_SMA_SLOPE_MAGNITUDE,
  TREND_SIDEWAYS_DISTANCE_DEADBAND,
  VOLUME_CLASSIFICATION_EPSILON,
} from './technical-analysis-thresholds.js';

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

function assertAllFinite(label: string, values: readonly number[]): void {
  for (let i: number = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new AnalysisComputationError(`${label} has non-finite value at index ${i}.`);
    }
  }
}

function slopeLabelFromLast10Sma(smaSeries: readonly number[]): 'rising' | 'flat' | 'falling' {
  const tail: number[] = smaSeries.filter((x) => Number.isFinite(x)).slice(-10);
  if (tail.length < 2) {
    return 'flat';
  }
  const first: number = tail[0] as number;
  const last: number = tail[tail.length - 1] as number;
  const avgDailyPct: number = (last - first) / first / (tail.length - 1);
  if (Math.abs(avgDailyPct) < SMA_SLOPE_FLAT_THRESHOLD) {
    return 'flat';
  }
  return avgDailyPct > 0 ? 'rising' : 'falling';
}

function detectCrossLast20(
  fast: readonly number[],
  slow: readonly number[],
  mode: 'golden' | 'death',
): boolean {
  const n: number = Math.min(fast.length, slow.length);
  const start: number = Math.max(1, n - 20);
  for (let i: number = start; i < n; i++) {
    const f0: number = fast[i - 1] as number;
    const f1: number = fast[i] as number;
    const s0: number = slow[i - 1] as number;
    const s1: number = slow[i] as number;
    if (![f0, f1, s0, s1].every(Number.isFinite)) {
      continue;
    }
    if (mode === 'golden' && f0 <= s0 && f1 > s1) {
      return true;
    }
    if (mode === 'death' && f0 >= s0 && f1 < s1) {
      return true;
    }
  }
  return false;
}

function nearestThreeAbove(input: { readonly pivots: readonly number[]; readonly price: number }): number[] {
  const above: number[] = input.pivots.filter((p) => p > input.price && Number.isFinite(p));
  const sorted: number[] = [...new Set(above)].sort((a, b) => a - b);
  return sorted.slice(0, 3);
}

function nearestThreeBelow(input: { readonly pivots: readonly number[]; readonly price: number }): number[] {
  const below: number[] = input.pivots.filter((p) => p < input.price && Number.isFinite(p));
  const sorted: number[] = [...new Set(below)].sort((a, b) => b - a);
  return sorted.slice(0, 3);
}

function classifyTrend(input: {
  readonly price: number;
  readonly sma: number;
  readonly smaSeriesForSlope: readonly number[];
}): 'uptrend' | 'downtrend' | 'sideways' {
  const { price, sma, smaSeriesForSlope } = input;
  if (!Number.isFinite(price) || !Number.isFinite(sma) || sma === 0) {
    return 'sideways';
  }
  const dist: number = (price - sma) / sma;
  const tail: number[] = smaSeriesForSlope.filter((x) => Number.isFinite(x)).slice(-10);
  let slope: number = 0;
  if (tail.length >= 2) {
    slope = (tail[tail.length - 1] as number) - (tail[0] as number);
    slope = slope / (tail[0] as number) / (tail.length - 1);
  }
  if (Math.abs(dist) < TREND_SIDEWAYS_DISTANCE_DEADBAND && Math.abs(slope) < TREND_MIN_SMA_SLOPE_MAGNITUDE) {
    return 'sideways';
  }
  if (dist > TREND_SIDEWAYS_DISTANCE_DEADBAND && slope >= -TREND_MIN_SMA_SLOPE_MAGNITUDE) {
    return 'uptrend';
  }
  if (dist < -TREND_SIDEWAYS_DISTANCE_DEADBAND && slope <= TREND_MIN_SMA_SLOPE_MAGNITUDE) {
    return 'downtrend';
  }
  return 'sideways';
}

/**
 * End-to-end Yahoo fetch + deterministic indicators for Technical Analysis (DB-172).
 * Throws {@link AnalysisComputationError} when history or math cannot satisfy ACs.
 */
export async function computeTechnicalAnalysisPayload(input: {
  readonly symbol: string;
  readonly now: Date;
}): Promise<{
  readonly payload: TechnicalAnalysisComputationPayload;
  readonly chartContext: TechnicalAnalysisBundleChartContext;
}> {
  const symbol: string = input.symbol.trim().toUpperCase();
  const { daily, weekly, monthly, quote } = await fetchTechnicalAnalysisMarketData({ symbol, now: input.now });
  const closes: number[] = daily.map((b) => b.adjClose);
  const highs: number[] = daily.map((b) => b.high);
  const lows: number[] = daily.map((b) => b.low);
  const volumes: number[] = daily.map((b) => b.volume);
  assertAllFinite('daily adjClose', closes);
  assertAllFinite('daily high', highs);
  assertAllFinite('daily low', lows);
  assertAllFinite('daily volume', volumes);

  const sma50: number[] = sma({ period: 50, values: closes });
  const sma100: number[] = sma({ period: 100, values: closes });
  const sma200: number[] = sma({ period: 200, values: closes });
  const lastSma50: number = sma50[sma50.length - 1] as number;
  const lastSma100: number = sma100[sma100.length - 1] as number;
  const lastSma200: number = sma200[sma200.length - 1] as number;
  if (![lastSma50, lastSma100, lastSma200].every(Number.isFinite)) {
    throw new AnalysisComputationError('SMA outputs incomplete — insufficient overlapping history.');
  }

  const rsi14: number[] = rsi({ period: 14, values: closes });
  const rsiLast6: number[] = rsi14.slice(-6);
  if (rsiLast6.length !== 6 || !rsiLast6.every(Number.isFinite)) {
    throw new AnalysisComputationError('RSI(14) requires 6 trailing finite values.');
  }

  const macdOut = macd({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const last5Macd: number[] = [];
  const last5Signal: number[] = [];
  const last5Hist: number[] = [];
  for (let i: number = macdOut.length - 5; i < macdOut.length; i++) {
    const row = macdOut[i];
    if (row?.MACD === undefined || row.signal === undefined || row.histogram === undefined) {
      throw new AnalysisComputationError('MACD incomplete near series end.');
    }
    last5Macd.push(row.MACD);
    last5Signal.push(row.signal);
    last5Hist.push(row.histogram);
  }

  let macdBull5: boolean = false;
  let macdBear5: boolean = false;
  for (let i: number = macdOut.length - 5; i < macdOut.length; i++) {
    if (i < 1) {
      continue;
    }
    const a0 = macdOut[i - 1];
    const a1 = macdOut[i];
    if (!a0?.MACD || !a1?.MACD || a0.signal === undefined || a1.signal === undefined) {
      continue;
    }
    if (a0.MACD <= a0.signal && a1.MACD > a1.signal) {
      macdBull5 = true;
    }
    if (a0.MACD >= a0.signal && a1.MACD < a1.signal) {
      macdBear5 = true;
    }
  }

  const bb = bollingerbands({ period: 20, stdDev: 2, values: closes });
  const lastBb = bb[bb.length - 1];
  if (
    lastBb?.upper === undefined ||
    lastBb.middle === undefined ||
    lastBb.lower === undefined ||
    !Number.isFinite(lastBb.upper) ||
    !Number.isFinite(lastBb.middle) ||
    !Number.isFinite(lastBb.lower)
  ) {
    throw new AnalysisComputationError('Bollinger Bands incomplete.');
  }
  const lastClose: number = closes[closes.length - 1] as number;
  const bw: number = (lastBb.upper - lastBb.lower) / (lastBb.middle === 0 ? Number.NaN : lastBb.middle);
  if (!Number.isFinite(bw)) {
    throw new AnalysisComputationError('Bollinger bandwidth not finite.');
  }
  const bwWindow: number[] = bb
    .slice(-6, -1)
    .map((r) => (r?.upper !== undefined && r.middle !== undefined && r.lower !== undefined ? (r.upper - r.lower) / r.middle : Number.NaN))
    .filter(Number.isFinite) as number[];
  const bwMean: number = bwWindow.reduce((a, b) => a + b, 0) / bwWindow.length;
  let bwClass: 'expanding' | 'contracting' | 'neutral' = 'neutral';
  if (bw > bwMean * (1 + BOLLINGER_BW_NEUTRAL_TOLERANCE)) {
    bwClass = 'expanding';
  } else if (bw < bwMean * (1 - BOLLINGER_BW_NEUTRAL_TOLERANCE)) {
    bwClass = 'contracting';
  }
  const percentB: number =
    lastBb.upper === lastBb.lower ? 0.5 : (lastClose - lastBb.lower) / (lastBb.upper - lastBb.lower);

  const last20: OhlcvBar[] = daily.slice(-20);
  const avgVol20: number = last20.reduce((s, b) => s + b.volume, 0) / last20.length;
  let upSum: number = 0;
  let upN: number = 0;
  let downSum: number = 0;
  let downN: number = 0;
  for (let i: number = 0; i < last20.length; i++) {
    const bar: OhlcvBar = last20[i] as OhlcvBar;
    if (bar.close >= bar.open) {
      upSum += bar.volume;
      upN += 1;
    } else {
      downSum += bar.volume;
      downN += 1;
    }
  }
  const avgUp: number = upN > 0 ? upSum / upN : 0;
  const avgDown: number = downN > 0 ? downSum / downN : 0;
  const obvSeries: number[] = obv({ close: closes, volume: volumes });
  const obvLast10: number[] = obvSeries.slice(-10);
  if (obvLast10.length !== 10 || !obvLast10.every(Number.isFinite)) {
    throw new AnalysisComputationError('OBV last 10 values incomplete.');
  }
  const latestVol: number = volumes[volumes.length - 1] as number;
  let volVs: 'above' | 'below' | 'neutral' = 'neutral';
  if (latestVol > avgVol20 * (1 + VOLUME_CLASSIFICATION_EPSILON)) {
    volVs = 'above';
  } else if (latestVol < avgVol20 * (1 - VOLUME_CLASSIFICATION_EPSILON)) {
    volVs = 'below';
  }

  const k: number = PIVOT_SWING_WINDOW_K;
  const fractalHighs = collectFractalPivotHighs({ highs, k });
  const fractalLows = collectFractalPivotLows({ lows, k });
  const pivotHighs: number[] = fractalHighs.map((p) => p.price);
  const pivotLows: number[] = fractalLows.map((p) => p.price);
  const currentPrice: number = quote.regularMarketPrice;
  const resist: number[] = nearestThreeAbove({ pivots: pivotHighs, price: currentPrice });
  const supp: number[] = nearestThreeBelow({ pivots: pivotLows, price: currentPrice });

  const { swingLow, swingHigh } = selectFibonacciSwingFromFractals({
    fractalHighs,
    fractalLows,
    dailyHighs: highs,
    dailyLows: lows,
  });
  const span: number = swingHigh - swingLow;
  const fib = {
    swingHigh,
    swingLow,
    levels236: swingLow + span * 0.236,
    levels382: swingLow + span * 0.382,
    levels500: swingLow + span * 0.5,
    levels618: swingLow + span * 0.618,
    levels786: swingLow + span * 0.786,
  };

  const weeklyCloses: number[] = weekly.map((b) => b.adjClose);
  const monthlyCloses: number[] = monthly.map((b) => b.adjClose);
  const sma10w: number[] = sma({ period: 10, values: weeklyCloses });
  const sma6m: number[] = sma({ period: 6, values: monthlyCloses });
  const wClose: number = weeklyCloses[weeklyCloses.length - 1] as number;
  const mClose: number = monthlyCloses[monthlyCloses.length - 1] as number;
  const wSma: number = sma10w[sma10w.length - 1] as number;
  const mSma: number = sma6m[sma6m.length - 1] as number;

  const atrSeries: number[] = atr({ high: highs, low: lows, close: closes, period: 14 });
  const atrLatest: number = atrSeries[atrSeries.length - 1] as number;
  if (!Number.isFinite(atrLatest)) {
    throw new AnalysisComputationError('ATR(14) not finite.');
  }

  const chartStart: number = Math.max(0, closes.length - BUNDLE_CHART_TAIL_BARS);
  const dailyTail: OhlcvBar[] = daily.slice(chartStart);
  const macdTail = macdOut.slice(chartStart);
  const chartContext: TechnicalAnalysisBundleChartContext = {
    symbol,
    tailLength: closes.length - chartStart,
    closes: closes.slice(chartStart),
    opens: dailyTail.map((b) => b.open),
    highs: dailyTail.map((b) => b.high),
    lows: dailyTail.map((b) => b.low),
    volumes: dailyTail.map((b) => b.volume),
    macdLine: macdTail.map((r) => (r?.MACD !== undefined && Number.isFinite(r.MACD) ? r.MACD : Number.NaN)),
    macdSignal: macdTail.map((r) => (r?.signal !== undefined && Number.isFinite(r.signal) ? r.signal : Number.NaN)),
    macdHistogram: macdTail.map((r) =>
      r?.histogram !== undefined && Number.isFinite(r.histogram) ? r.histogram : Number.NaN,
    ),
    rsi: rsi14.slice(chartStart).map((x) => (Number.isFinite(x) ? x : Number.NaN)),
    bbUpper: bb.slice(chartStart).map((r) => (r?.upper !== undefined && Number.isFinite(r.upper) ? r.upper : Number.NaN)),
    bbMiddle: bb.slice(chartStart).map((r) => (r?.middle !== undefined && Number.isFinite(r.middle) ? r.middle : Number.NaN)),
    bbLower: bb.slice(chartStart).map((r) => (r?.lower !== undefined && Number.isFinite(r.lower) ? r.lower : Number.NaN)),
    obv: obvSeries.slice(chartStart),
    sma50: sma50.slice(chartStart),
    sma100: sma100.slice(chartStart),
    sma200: sma200.slice(chartStart),
    atr: atrSeries.slice(chartStart),
  };

  const payload: TechnicalAnalysisComputationPayload = {
    reproduction: { dailyAdjCloses: closes },
    meta: {
      symbol,
      computedAtIso: input.now.toISOString(),
      currentPriceDefinition: 'yahoo_regular_market_price_else_last_daily_adj_close',
    },
    quote,
    seriesLengths: { daily: daily.length, weekly: weekly.length, monthly: monthly.length },
    movingAverages: {
      sma50: sma50.slice(-10),
      sma100: sma100.slice(-10),
      sma200: sma200.slice(-10),
      sma50SlopeLabel: slopeLabelFromLast10Sma(sma50),
      sma100SlopeLabel: slopeLabelFromLast10Sma(sma100),
      sma200SlopeLabel: slopeLabelFromLast10Sma(sma200),
      goldenCrossInLast20Sessions: detectCrossLast20(sma50, sma200, 'golden'),
      deathCrossInLast20Sessions: detectCrossLast20(sma50, sma200, 'death'),
    },
    rsi14: { last6: rsiLast6 },
    macd: {
      last5Macd,
      last5Signal: last5Signal,
      last5Histogram: last5Hist,
      signalCrossoverBullishLast5: macdBull5,
      signalCrossoverBearishLast5: macdBear5,
    },
    bollinger: {
      upper: lastBb.upper,
      middle: lastBb.middle,
      lower: lastBb.lower,
      percentB,
      bandwidthClassification: bwClass,
    },
    volume: {
      avg20: avgVol20,
      avgUpClose20: avgUp,
      avgDownClose20: avgDown,
      obvLast10,
      latestVsAvg20: volVs,
    },
    levels: {
      resistanceUpTo3: resist,
      supportUpTo3: supp,
      fib,
    },
    trend: {
      daily: classifyTrend({ price: currentPrice, sma: lastSma50, smaSeriesForSlope: sma50 }),
      weekly: classifyTrend({ price: wClose, sma: wSma, smaSeriesForSlope: sma10w }),
      monthly: classifyTrend({ price: mClose, sma: mSma, smaSeriesForSlope: sma6m }),
    },
    atr14: { latest: atrLatest },
  };
  return { payload, chartContext };
}

export function logSanitizedTechnicalPayloadSummary(input: {
  readonly payload: TechnicalAnalysisComputationPayload;
  readonly log: { readonly info: (o: Record<string, unknown>) => void };
}): void {
  const p: TechnicalAnalysisComputationPayload = input.payload;
  input.log.info({
    evt: 'technical_analysis_payload_ready',
    symbol: p.meta.symbol,
    dailyBars: p.seriesLengths.daily,
    weeklyBars: p.seriesLengths.weekly,
    monthlyBars: p.seriesLengths.monthly,
    rsiPoints: p.rsi14.last6.length,
    macdPoints: p.macd.last5Macd.length,
    resistanceCount: p.levels.resistanceUpTo3.length,
    supportCount: p.levels.supportUpTo3.length,
  });
}
