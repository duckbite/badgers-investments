import { describe, expect, it } from 'vitest';
import { computeLevels } from './levels.js';

describe('computeLevels', () => {
  it('returns up to 3 resistance levels above price', () => {
    const result = computeLevels({
      pivotHighs: [110, 115, 120, 125],
      pivotLows: [90, 85, 80],
      currentPrice: 100,
      swingHigh: 125,
      swingLow: 80,
    });
    expect(result.resistanceUpTo3.length).toBeLessThanOrEqual(3);
    result.resistanceUpTo3.forEach((r) => expect(r).toBeGreaterThan(100));
  });

  it('returns up to 3 support levels below price', () => {
    const result = computeLevels({
      pivotHighs: [110, 115, 120, 125],
      pivotLows: [90, 85, 80],
      currentPrice: 100,
      swingHigh: 125,
      swingLow: 80,
    });
    expect(result.supportUpTo3.length).toBeLessThanOrEqual(3);
    result.supportUpTo3.forEach((s) => expect(s).toBeLessThan(100));
  });

  it('fibonacci levels span from swingLow to swingHigh', () => {
    const result = computeLevels({
      pivotHighs: [115],
      pivotLows: [85],
      currentPrice: 100,
      swingHigh: 120,
      swingLow: 80,
    });
    expect(result.fib.swingHigh).toBe(120);
    expect(result.fib.swingLow).toBe(80);
    expect(result.fib.levels382).toBeCloseTo(80 + 40 * 0.382, 2);
  });
});
