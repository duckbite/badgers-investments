import { macd } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';

export type MacdResult = {
  readonly last5Macd: readonly number[];
  readonly last5Signal: readonly number[];
  readonly last5Histogram: readonly number[];
  readonly signalCrossoverBullishLast5: boolean;
  readonly signalCrossoverBearishLast5: boolean;
};

export function computeMacd(closes: readonly number[]): MacdResult {
  const macdOut = macd({
    values: closes as number[],
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const last5Macd: number[] = [];
  const last5Signal: number[] = [];
  const last5Histogram: number[] = [];
  for (let i: number = macdOut.length - 5; i < macdOut.length; i++) {
    const row = macdOut[i];
    if (row?.MACD === undefined || row.signal === undefined || row.histogram === undefined) {
      throw new AnalysisComputationError('MACD incomplete near series end.');
    }
    last5Macd.push(row.MACD);
    last5Signal.push(row.signal);
    last5Histogram.push(row.histogram);
  }
  if (last5Macd.length !== 5) {
    throw new AnalysisComputationError('MACD incomplete near series end.');
  }
  let signalCrossoverBullishLast5: boolean = false;
  let signalCrossoverBearishLast5: boolean = false;
  for (let i: number = macdOut.length - 5; i < macdOut.length; i++) {
    if (i < 1) continue;
    const a0 = macdOut[i - 1];
    const a1 = macdOut[i];
    if (!a0?.MACD || !a1?.MACD || a0.signal === undefined || a1.signal === undefined) continue;
    if (a0.MACD <= a0.signal && a1.MACD > a1.signal) signalCrossoverBullishLast5 = true;
    if (a0.MACD >= a0.signal && a1.MACD < a1.signal) signalCrossoverBearishLast5 = true;
  }
  return { last5Macd, last5Signal, last5Histogram, signalCrossoverBullishLast5, signalCrossoverBearishLast5 };
}
