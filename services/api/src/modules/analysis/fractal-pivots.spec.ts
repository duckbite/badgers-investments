import { describe, expect, it } from 'vitest';
import {
  collectFractalPivotHighs,
  collectFractalPivotLows,
  selectFibonacciSwingFromFractals,
} from './fractal-pivots.js';

describe('selectFibonacciSwingFromFractals', () => {
  it('uses the last completed up-leg: most recent swing low before the latest swing high', () => {
    const leg = selectFibonacciSwingFromFractals({
      fractalHighs: [
        { index: 10, price: 100 },
        { index: 18, price: 120 },
      ],
      fractalLows: [
        { index: 5, price: 80 },
        { index: 14, price: 90 },
      ],
      dailyHighs: [],
      dailyLows: [],
    });
    expect(leg.swingLow).toBe(90);
    expect(leg.swingHigh).toBe(120);
  });

  it('uses the last completed down-leg: most recent swing high before the latest swing low', () => {
    const leg = selectFibonacciSwingFromFractals({
      fractalHighs: [{ index: 8, price: 130 }],
      fractalLows: [{ index: 20, price: 95 }],
      dailyHighs: [],
      dailyLows: [],
    });
    expect(leg.swingHigh).toBe(130);
    expect(leg.swingLow).toBe(95);
  });
});

describe('collectFractalPivotHighs', () => {
  it('detects a strict peak with k=2', () => {
    const highs: number[] = [1, 2, 3, 10, 3, 2, 1];
    const pivots = collectFractalPivotHighs({ highs, k: 2 });
    expect(pivots.some((p) => p.price === 10)).toBe(true);
  });
});

describe('collectFractalPivotLows', () => {
  it('detects a strict trough with k=2', () => {
    const lows: number[] = [9, 8, 7, 1, 7, 8, 9];
    const pivots = collectFractalPivotLows({ lows, k: 2 });
    expect(pivots.some((p) => p.price === 1)).toBe(true);
  });
});
