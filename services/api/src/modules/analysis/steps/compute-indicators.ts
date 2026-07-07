import { atr, bollingerbands, macd, obv, rsi, sma } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { BUNDLE_CHART_TAIL_BARS } from '../bundle-chart-context.js';
import type { TechnicalAnalysisBundleChartContext } from '../bundle-chart-context.js';
import type { TechnicalAnalysisComputationPayload } from '../compute-technical-analysis-payload.js';
import { PIVOT_SWING_WINDOW_K } from '../technical-analysis-thresholds.js';
import { computeAtr14 } from '../indicators/atr.js';
import { computeBollingerBands } from '../indicators/bollinger-bands.js';
import {
  collectFractalPivotHighs,
  collectFractalPivotLows,
  selectFibonacciSwingFromFractals,
} from '../indicators/fractal-pivots.js';
import { computeLevels } from '../indicators/levels.js';
import { computeMacd } from '../indicators/macd.js';
import { computeMovingAverages } from '../indicators/moving-averages.js';
import { computeRsi14 } from '../indicators/rsi.js';
import { classifyTrend } from '../indicators/trend.js';
import { computeVolumeAnalysis } from '../indicators/volume.js';
import type { OhlcvBar, YahooQuoteSnapshot } from './fetch-market-data.js';

function assertAllFinite(label: string, values: readonly number[]): void {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new AnalysisComputationError(`${label} has non-finite value at index ${i}.`);
    }
  }
}

export async function computeIndicators(input: {
  readonly symbol: string;
  readonly now: Date;
  readonly daily: readonly OhlcvBar[];
  readonly weekly: readonly OhlcvBar[];
  readonly monthly: readonly OhlcvBar[];
  readonly quote: YahooQuoteSnapshot;
}): Promise<{
  readonly payload: TechnicalAnalysisComputationPayload;
  readonly chartContext: TechnicalAnalysisBundleChartContext;
}> {
  const { symbol, now, daily, weekly, monthly, quote } = input;
  const closes: number[] = daily.map((b) => b.adjClose);
  const highs: number[] = daily.map((b) => b.high);
  const lows: number[] = daily.map((b) => b.low);
  const volumes: number[] = daily.map((b) => b.volume);
  assertAllFinite('daily adjClose', closes);
  assertAllFinite('daily high', highs);
  assertAllFinite('daily low', lows);
  assertAllFinite('daily volume', volumes);

  const maResult = computeMovingAverages(closes);
  const rsiResult = computeRsi14(closes);
  const macdResult = computeMacd(closes);
  const bbResult = computeBollingerBands(closes);
  const volumeResult = computeVolumeAnalysis({ bars: daily, closes });
  const atrResult = computeAtr14({ highs, lows, closes });

  const k: number = PIVOT_SWING_WINDOW_K;
  const fractalHighs = collectFractalPivotHighs({ highs, k });
  const fractalLows = collectFractalPivotLows({ lows, k });
  const { swingLow, swingHigh } = selectFibonacciSwingFromFractals({
    fractalHighs, fractalLows, dailyHighs: highs, dailyLows: lows,
  });
  const levelsResult = computeLevels({
    pivotHighs: fractalHighs.map((p) => p.price),
    pivotLows: fractalLows.map((p) => p.price),
    currentPrice: quote.regularMarketPrice,
    swingHigh,
    swingLow,
  });

  const weeklyCloses: number[] = weekly.map((b) => b.adjClose);
  const monthlyCloses: number[] = monthly.map((b) => b.adjClose);
  const sma10w: number[] = sma({ period: 10, values: weeklyCloses });
  const sma6m: number[] = sma({ period: 6, values: monthlyCloses });
  const wClose: number = weeklyCloses[weeklyCloses.length - 1];
  const mClose: number = monthlyCloses[monthlyCloses.length - 1];
  const wSma: number = sma10w[sma10w.length - 1];
  const mSma: number = sma6m[sma6m.length - 1];

  const chartStart: number = Math.max(0, closes.length - BUNDLE_CHART_TAIL_BARS);
  const dailyTail: readonly OhlcvBar[] = daily.slice(chartStart);

  const macdFull = macd({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const rsi14Full: number[] = rsi({ period: 14, values: closes });
  const bbFull = bollingerbands({ period: 20, stdDev: 2, values: closes });
  const obvFull: number[] = obv({ close: closes, volume: volumes });
  const atrFull: number[] = atr({ high: highs, low: lows, close: closes, period: 14 });

  const chartContext: TechnicalAnalysisBundleChartContext = {
    symbol,
    tailLength: closes.length - chartStart,
    closes: closes.slice(chartStart),
    opens: dailyTail.map((b) => b.open),
    highs: dailyTail.map((b) => b.high),
    lows: dailyTail.map((b) => b.low),
    volumes: dailyTail.map((b) => b.volume),
    macdLine: macdFull.slice(chartStart).map((r) => (r?.MACD !== undefined && Number.isFinite(r.MACD) ? r.MACD : Number.NaN)),
    macdSignal: macdFull.slice(chartStart).map((r) => (r?.signal !== undefined && Number.isFinite(r.signal) ? r.signal : Number.NaN)),
    macdHistogram: macdFull.slice(chartStart).map((r) => (r?.histogram !== undefined && Number.isFinite(r.histogram) ? r.histogram : Number.NaN)),
    rsi: rsi14Full.slice(chartStart).map((x) => (Number.isFinite(x) ? x : Number.NaN)),
    bbUpper: bbFull.slice(chartStart).map((r) => (r?.upper !== undefined && Number.isFinite(r.upper) ? r.upper : Number.NaN)),
    bbMiddle: bbFull.slice(chartStart).map((r) => (r?.middle !== undefined && Number.isFinite(r.middle) ? r.middle : Number.NaN)),
    bbLower: bbFull.slice(chartStart).map((r) => (r?.lower !== undefined && Number.isFinite(r.lower) ? r.lower : Number.NaN)),
    obv: obvFull.slice(chartStart),
    sma50: maResult.sma50.slice(chartStart),
    sma100: maResult.sma100.slice(chartStart),
    sma200: maResult.sma200.slice(chartStart),
    atr: atrFull.slice(chartStart),
  };

  const payload: TechnicalAnalysisComputationPayload = {
    reproduction: { dailyAdjCloses: closes },
    meta: { symbol, computedAtIso: now.toISOString(), currentPriceDefinition: 'yahoo_regular_market_price_else_last_daily_adj_close' },
    quote,
    seriesLengths: { daily: daily.length, weekly: weekly.length, monthly: monthly.length },
    movingAverages: {
      sma50: maResult.sma50.slice(-10),
      sma100: maResult.sma100.slice(-10),
      sma200: maResult.sma200.slice(-10),
      sma50SlopeLabel: maResult.sma50SlopeLabel,
      sma100SlopeLabel: maResult.sma100SlopeLabel,
      sma200SlopeLabel: maResult.sma200SlopeLabel,
      goldenCrossInLast20Sessions: maResult.goldenCrossInLast20Sessions,
      deathCrossInLast20Sessions: maResult.deathCrossInLast20Sessions,
    },
    rsi14: { last6: rsiResult.last6 },
    macd: {
      last5Macd: macdResult.last5Macd,
      last5Signal: macdResult.last5Signal,
      last5Histogram: macdResult.last5Histogram,
      signalCrossoverBullishLast5: macdResult.signalCrossoverBullishLast5,
      signalCrossoverBearishLast5: macdResult.signalCrossoverBearishLast5,
    },
    bollinger: bbResult,
    volume: volumeResult,
    levels: {
      resistanceUpTo3: levelsResult.resistanceUpTo3,
      supportUpTo3: levelsResult.supportUpTo3,
      fib: levelsResult.fib,
    },
    trend: {
      daily: classifyTrend({ price: quote.regularMarketPrice, sma: maResult.sma50[maResult.sma50.length - 1], smaSeriesForSlope: maResult.sma50 }),
      weekly: classifyTrend({ price: wClose, sma: wSma, smaSeriesForSlope: sma10w }),
      monthly: classifyTrend({ price: mClose, sma: mSma, smaSeriesForSlope: sma6m }),
    },
    atr14: { latest: atrResult.latest },
  };
  return { payload, chartContext };
}
