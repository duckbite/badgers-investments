import {
  TREND_MIN_SMA_SLOPE_MAGNITUDE,
  TREND_SIDEWAYS_DISTANCE_DEADBAND,
} from '../technical-analysis-thresholds.js';

export type TrendLabel = 'uptrend' | 'downtrend' | 'sideways';

export function classifyTrend(input: {
  readonly price: number;
  readonly sma: number;
  readonly smaSeriesForSlope: readonly number[];
}): TrendLabel {
  const { price, sma, smaSeriesForSlope } = input;
  if (!Number.isFinite(price) || !Number.isFinite(sma) || sma === 0) return 'sideways';
  const dist: number = (price - sma) / sma;
  const tail: number[] = smaSeriesForSlope.filter((x) => Number.isFinite(x)).slice(-10);
  let slope = 0;
  if (tail.length >= 2) {
    const first = tail[0] as number;
    slope = ((tail[tail.length - 1] as number) - first) / first / (tail.length - 1);
  }
  if (Math.abs(dist) < TREND_SIDEWAYS_DISTANCE_DEADBAND && Math.abs(slope) < TREND_MIN_SMA_SLOPE_MAGNITUDE) return 'sideways';
  if (dist > TREND_SIDEWAYS_DISTANCE_DEADBAND && slope >= -TREND_MIN_SMA_SLOPE_MAGNITUDE) return 'uptrend';
  if (dist < -TREND_SIDEWAYS_DISTANCE_DEADBAND && slope <= TREND_MIN_SMA_SLOPE_MAGNITUDE) return 'downtrend';
  return 'sideways';
}
