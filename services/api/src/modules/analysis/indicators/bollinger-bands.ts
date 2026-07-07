import { bollingerbands } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { BOLLINGER_BW_NEUTRAL_TOLERANCE } from '../technical-analysis-thresholds.js';

export type BollingerBandsResult = {
  readonly upper: number;
  readonly middle: number;
  readonly lower: number;
  readonly percentB: number;
  readonly bandwidthClassification: 'expanding' | 'contracting' | 'neutral';
};

export function computeBollingerBands(closes: readonly number[]): BollingerBandsResult {
  const bb = bollingerbands({ period: 20, stdDev: 2, values: closes as number[] });
  const lastBb = bb[bb.length - 1];
  if (
    lastBb?.upper === undefined || lastBb.middle === undefined || lastBb.lower === undefined ||
    !Number.isFinite(lastBb.upper) || !Number.isFinite(lastBb.middle) || !Number.isFinite(lastBb.lower)
  ) {
    throw new AnalysisComputationError('Bollinger Bands incomplete.');
  }
  const lastClose: number = closes[closes.length - 1];
  const bw: number = (lastBb.upper - lastBb.lower) / (lastBb.middle === 0 ? Number.NaN : lastBb.middle);
  if (!Number.isFinite(bw)) {
    throw new AnalysisComputationError('Bollinger bandwidth not finite.');
  }
  const bwWindow: number[] = bb
    .slice(-6, -1)
    .map((r) => (r?.upper !== undefined && r.middle !== undefined && r.lower !== undefined ? (r.upper - r.lower) / r.middle : Number.NaN))
    .filter(Number.isFinite);
  const bwMean: number = bwWindow.length > 0 ? bwWindow.reduce((a, b) => a + b, 0) / bwWindow.length : bw;
  let bandwidthClassification: 'expanding' | 'contracting' | 'neutral' = 'neutral';
  if (bw > bwMean * (1 + BOLLINGER_BW_NEUTRAL_TOLERANCE)) bandwidthClassification = 'expanding';
  else if (bw < bwMean * (1 - BOLLINGER_BW_NEUTRAL_TOLERANCE)) bandwidthClassification = 'contracting';
  const percentB: number = lastBb.upper === lastBb.lower ? 0.5 : (lastClose - lastBb.lower) / (lastBb.upper - lastBb.lower);
  return { upper: lastBb.upper, middle: lastBb.middle, lower: lastBb.lower, percentB, bandwidthClassification };
}
