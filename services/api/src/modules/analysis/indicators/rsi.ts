import { rsi } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';

export type Rsi14Result = {
  readonly last6: readonly number[];
};

export function computeRsi14(closes: readonly number[]): Rsi14Result {
  const rsi14: number[] = rsi({ period: 14, values: closes as number[] });
  const last6: number[] = rsi14.slice(-6);
  if (last6.length !== 6 || !last6.every(Number.isFinite)) {
    throw new AnalysisComputationError('RSI(14) requires 6 trailing finite values.');
  }
  return { last6 };
}
