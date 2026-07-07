import { describe, expect, it } from 'vitest';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { computeMovingAverages } from './moving-averages.js';

const PRICES: readonly number[] = Array.from({ length: 250 }, (_, i) => 100 + i * 0.1 + Math.sin(i * 0.1) * 2);

describe('computeMovingAverages', () => {
  it('returns finite sma50, sma100, sma200 last values', () => {
    const result = computeMovingAverages(PRICES);
    expect(Number.isFinite(result.sma50[result.sma50.length - 1])).toBe(true);
    expect(Number.isFinite(result.sma100[result.sma100.length - 1])).toBe(true);
    expect(Number.isFinite(result.sma200[result.sma200.length - 1])).toBe(true);
  });

  it('slope labels are valid values', () => {
    const result = computeMovingAverages(PRICES);
    expect(['rising', 'flat', 'falling']).toContain(result.sma50SlopeLabel);
    expect(['rising', 'flat', 'falling']).toContain(result.sma100SlopeLabel);
    expect(['rising', 'flat', 'falling']).toContain(result.sma200SlopeLabel);
  });

  it('cross flags are booleans', () => {
    const result = computeMovingAverages(PRICES);
    expect(typeof result.goldenCrossInLast20Sessions).toBe('boolean');
    expect(typeof result.deathCrossInLast20Sessions).toBe('boolean');
  });

  it('throws AnalysisComputationError when fewer than 200 closes provided', () => {
    const short: number[] = Array.from({ length: 150 }, (_, i) => 100 + i);
    expect(() => computeMovingAverages(short)).toThrow(AnalysisComputationError);
  });
});
