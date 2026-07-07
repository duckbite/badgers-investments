import { describe, expect, it } from 'vitest';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { computeMacd } from './macd.js';

const PRICES: readonly number[] = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 5 + i * 0.5);

describe('computeMacd', () => {
  it('returns 5 values for each of macd, signal, histogram', () => {
    const result = computeMacd(PRICES);
    expect(result.last5Macd).toHaveLength(5);
    expect(result.last5Signal).toHaveLength(5);
    expect(result.last5Histogram).toHaveLength(5);
    result.last5Macd.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it('returns boolean crossover flags', () => {
    const result = computeMacd(PRICES);
    expect(typeof result.signalCrossoverBullishLast5).toBe('boolean');
    expect(typeof result.signalCrossoverBearishLast5).toBe('boolean');
  });

  it('throws AnalysisComputationError for series too short to produce 5 MACD values', () => {
    const short: number[] = Array.from({ length: 5 }, (_, i) => 100 + i);
    expect(() => computeMacd(short)).toThrow(AnalysisComputationError);
  });
});
