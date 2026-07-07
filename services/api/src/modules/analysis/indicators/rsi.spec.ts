import { describe, expect, it } from 'vitest';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { computeRsi14 } from './rsi.js';

const PRICES: readonly number[] = [
  100, 101, 100.5, 102, 103, 102.5, 104, 103, 105, 104,
  106, 105.5, 107, 106, 108, 107, 109, 108.5, 110, 109,
];

describe('computeRsi14', () => {
  it('returns an object with last6 containing 6 finite values', () => {
    const result = computeRsi14(PRICES);
    expect(result.last6).toHaveLength(6);
    result.last6.forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('throws AnalysisComputationError when fewer than 20 prices are provided', () => {
    const short: number[] = Array.from({ length: 15 }, (_, i) => 100 + i);
    expect(() => computeRsi14(short)).toThrow(AnalysisComputationError);
  });
});
