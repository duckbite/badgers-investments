import { describe, expect, it } from 'vitest';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { computeAtr14 } from './atr.js';

const N = 30;
const HIGHS = Array.from({ length: N }, (_, i) => 105 + i * 0.1);
const LOWS = Array.from({ length: N }, (_, i) => 95 + i * 0.1);
const CLOSES = Array.from({ length: N }, (_, i) => 100 + i * 0.1);

describe('computeAtr14', () => {
  it('returns a finite positive latest ATR', () => {
    const result = computeAtr14({ highs: HIGHS, lows: LOWS, closes: CLOSES });
    expect(Number.isFinite(result.latest)).toBe(true);
    expect(result.latest).toBeGreaterThan(0);
  });

  it('throws AnalysisComputationError when series too short', () => {
    const short = [100, 101, 102];
    expect(() => computeAtr14({ highs: short, lows: short, closes: short })).toThrow(AnalysisComputationError);
  });
});
