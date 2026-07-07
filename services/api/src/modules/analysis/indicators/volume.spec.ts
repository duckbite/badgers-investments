import { describe, expect, it } from 'vitest';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { computeVolumeAnalysis } from './volume.js';
import type { OhlcvBar } from '../fetch-technical-analysis-market-data.js';

function makeBar(close: number, open: number, volume: number): OhlcvBar {
  return { dateIso: '2024-01-01T00:00:00.000Z', open, high: close + 1, low: open - 1, close, adjClose: close, volume };
}

const BARS: readonly OhlcvBar[] = [
  ...Array.from({ length: 20 }, (_, i) => makeBar(100 + i, 99 + i, 1000 + i * 10)),
];
const CLOSES: readonly number[] = BARS.map((b) => b.adjClose);

describe('computeVolumeAnalysis', () => {
  it('returns finite avg20', () => {
    const result = computeVolumeAnalysis({ bars: BARS, closes: CLOSES });
    expect(Number.isFinite(result.avg20)).toBe(true);
    expect(result.avg20).toBeGreaterThan(0);
  });

  it('returns 10 OBV values', () => {
    const result = computeVolumeAnalysis({ bars: BARS, closes: CLOSES });
    expect(result.obvLast10).toHaveLength(10);
    result.obvLast10.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it('latestVsAvg20 is one of the valid labels', () => {
    const result = computeVolumeAnalysis({ bars: BARS, closes: CLOSES });
    expect(['above', 'below', 'neutral']).toContain(result.latestVsAvg20);
  });

  it('throws AnalysisComputationError when fewer than 20 bars', () => {
    const short = BARS.slice(0, 10);
    expect(() => computeVolumeAnalysis({ bars: short, closes: short.map((b) => b.adjClose) })).toThrow(AnalysisComputationError);
  });
});
