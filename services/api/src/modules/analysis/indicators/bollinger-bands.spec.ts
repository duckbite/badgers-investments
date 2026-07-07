import { describe, expect, it } from 'vitest';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { computeBollingerBands } from './bollinger-bands.js';

const PRICES: readonly number[] = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.5) * 3);

describe('computeBollingerBands', () => {
  it('returns upper > middle > lower', () => {
    const result = computeBollingerBands(PRICES);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });

  it('percentB is between 0 and 1 for mid-range price', () => {
    const result = computeBollingerBands(PRICES);
    expect(result.percentB).toBeGreaterThanOrEqual(0);
    expect(result.percentB).toBeLessThanOrEqual(1);
  });

  it('bandwidthClassification is one of the three values', () => {
    const result = computeBollingerBands(PRICES);
    expect(['expanding', 'contracting', 'neutral']).toContain(result.bandwidthClassification);
  });

  it('throws AnalysisComputationError when series too short', () => {
    const short: number[] = Array.from({ length: 5 }, (_, i) => 100 + i);
    expect(() => computeBollingerBands(short)).toThrow(AnalysisComputationError);
  });
});
