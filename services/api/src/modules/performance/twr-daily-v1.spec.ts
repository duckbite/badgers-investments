import { describe, expect, it } from 'vitest';
import { computeDailyTwrChain, getTwrDailyV1Metadata } from './twr-daily-v1.js';

describe('getTwrDailyV1Metadata', () => {
  it('exposes stable method identifiers', () => {
    const meta = getTwrDailyV1Metadata();
    expect(meta.calculationMethod).toBe('TWR_DAILY_V1');
    expect(meta.calculationVersion).toBe('1');
  });
});

describe('computeDailyTwrChain', () => {
  it('chains holding-period returns from consecutive valuations', () => {
    const points = computeDailyTwrChain({
      values: [
        { snapshotDate: '2026-01-01', totalMarketValueAmount: '100' },
        { snapshotDate: '2026-01-02', totalMarketValueAmount: '110' },
        { snapshotDate: '2026-01-03', totalMarketValueAmount: '99' },
      ],
    });
    expect(points).toHaveLength(2);
    expect(points[0]?.periodDate).toBe('2026-01-02');
    expect(points[0]?.subperiodReturn).toBe('0.1');
    expect(points[0]?.cumulativeTwrReturn).toBe('0.1');
    expect(points[1]?.periodDate).toBe('2026-01-03');
    expect(points[1]?.subperiodReturn).toBe('-0.1');
    expect(points[1]?.cumulativeTwrReturn).toBe('-0.01');
  });

  it('treats a zero starting value as a neutral subperiod', () => {
    const points = computeDailyTwrChain({
      values: [
        { snapshotDate: '2026-01-01', totalMarketValueAmount: '0' },
        { snapshotDate: '2026-01-02', totalMarketValueAmount: '50' },
      ],
    });
    expect(points).toHaveLength(1);
    expect(points[0]?.subperiodReturn).toBe('0');
    expect(points[0]?.cumulativeTwrReturn).toBe('0');
  });
});
