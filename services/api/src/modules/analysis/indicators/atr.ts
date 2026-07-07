import { atr } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';

export type Atr14Result = {
  readonly latest: number;
  readonly series: readonly number[];
};

export function computeAtr14(input: {
  readonly highs: readonly number[];
  readonly lows: readonly number[];
  readonly closes: readonly number[];
}): Atr14Result {
  const series: number[] = atr({
    high: input.highs as number[],
    low: input.lows as number[],
    close: input.closes as number[],
    period: 14,
  });
  const latest: number = series[series.length - 1];
  if (!Number.isFinite(latest)) {
    throw new AnalysisComputationError('ATR(14) not finite.');
  }
  return { latest, series };
}
