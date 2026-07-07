import { describe, expect, it } from 'vitest';
import { classifyTrend } from './trend.js';

const risingSmaSeries = Array.from({ length: 15 }, (_, i) => 100 + i * 0.5);
const flatSmaSeries = Array.from({ length: 15 }, () => 100);

describe('classifyTrend', () => {
  it('returns uptrend when price well above rising SMA', () => {
    const result = classifyTrend({ price: 115, sma: 100, smaSeriesForSlope: risingSmaSeries });
    expect(result).toBe('uptrend');
  });

  it('returns downtrend when price well below falling SMA', () => {
    const falling = risingSmaSeries.map((v) => 200 - v);
    const result = classifyTrend({ price: 85, sma: 100, smaSeriesForSlope: falling });
    expect(result).toBe('downtrend');
  });

  it('returns sideways when price near SMA with flat slope', () => {
    const result = classifyTrend({ price: 100.5, sma: 100, smaSeriesForSlope: flatSmaSeries });
    expect(result).toBe('sideways');
  });

  it('returns sideways when price or sma is not finite', () => {
    const result = classifyTrend({ price: Number.NaN, sma: 100, smaSeriesForSlope: risingSmaSeries });
    expect(result).toBe('sideways');
  });
});
