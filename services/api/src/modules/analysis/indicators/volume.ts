import { obv } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { VOLUME_CLASSIFICATION_EPSILON } from '../technical-analysis-thresholds.js';
import type { OhlcvBar } from '../fetch-technical-analysis-market-data.js';

export type VolumeAnalysisResult = {
  readonly avg20: number;
  readonly avgUpClose20: number;
  readonly avgDownClose20: number;
  readonly obvLast10: readonly number[];
  readonly latestVsAvg20: 'above' | 'below' | 'neutral';
};

export function computeVolumeAnalysis(input: {
  readonly bars: readonly OhlcvBar[];
  readonly closes: readonly number[];
}): VolumeAnalysisResult {
  const { bars, closes } = input;
  if (bars.length < 20) {
    throw new AnalysisComputationError('Volume analysis requires at least 20 bars.');
  }
  const last20: readonly OhlcvBar[] = bars.slice(-20);
  const avgVol20: number = last20.reduce((s, b) => s + b.volume, 0) / last20.length;
  let upSum = 0, upN = 0, downSum = 0, downN = 0;
  for (const bar of last20) {
    if (bar.close >= bar.open) { upSum += bar.volume; upN += 1; }
    else { downSum += bar.volume; downN += 1; }
  }
  const volumes: number[] = bars.map((b) => b.volume);
  const obvSeries: number[] = obv({ close: closes as number[], volume: volumes });
  const obvLast10: number[] = obvSeries.slice(-10);
  if (obvLast10.length !== 10 || !obvLast10.every(Number.isFinite)) {
    throw new AnalysisComputationError('OBV last 10 values incomplete.');
  }
  const latestVol: number = volumes[volumes.length - 1] as number;
  let latestVsAvg20: 'above' | 'below' | 'neutral' = 'neutral';
  if (latestVol > avgVol20 * (1 + VOLUME_CLASSIFICATION_EPSILON)) latestVsAvg20 = 'above';
  else if (latestVol < avgVol20 * (1 - VOLUME_CLASSIFICATION_EPSILON)) latestVsAvg20 = 'below';
  return {
    avg20: avgVol20,
    avgUpClose20: upN > 0 ? upSum / upN : 0,
    avgDownClose20: downN > 0 ? downSum / downN : 0,
    obvLast10,
    latestVsAvg20,
  };
}
