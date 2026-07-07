import { sma } from 'technicalindicators';
import { AnalysisComputationError } from '../analysis-computation-error.js';
import { SMA_SLOPE_FLAT_THRESHOLD } from '../technical-analysis-thresholds.js';

export type MovingAveragesResult = {
  readonly sma50: readonly number[];
  readonly sma100: readonly number[];
  readonly sma200: readonly number[];
  readonly sma50SlopeLabel: 'rising' | 'flat' | 'falling';
  readonly sma100SlopeLabel: 'rising' | 'flat' | 'falling';
  readonly sma200SlopeLabel: 'rising' | 'flat' | 'falling';
  readonly goldenCrossInLast20Sessions: boolean;
  readonly deathCrossInLast20Sessions: boolean;
};

export function slopeLabelFromLast10Sma(smaSeries: readonly number[]): 'rising' | 'flat' | 'falling' {
  const tail: number[] = smaSeries.filter((x) => Number.isFinite(x)).slice(-10);
  if (tail.length < 2) return 'flat';
  const first: number = tail[0];
  const last: number = tail[tail.length - 1];
  const avgDailyPct: number = (last - first) / first / (tail.length - 1);
  if (Math.abs(avgDailyPct) < SMA_SLOPE_FLAT_THRESHOLD) return 'flat';
  return avgDailyPct > 0 ? 'rising' : 'falling';
}

export function detectCrossLast20(fast: readonly number[], slow: readonly number[], mode: 'golden' | 'death'): boolean {
  const n: number = Math.min(fast.length, slow.length);
  const start: number = Math.max(1, n - 20);
  for (let i: number = start; i < n; i++) {
    const f0 = fast[i - 1];
    const f1 = fast[i];
    const s0 = slow[i - 1];
    const s1 = slow[i];
    if (![f0, f1, s0, s1].every(Number.isFinite)) continue;
    if (mode === 'golden' && f0 <= s0 && f1 > s1) return true;
    if (mode === 'death' && f0 >= s0 && f1 < s1) return true;
  }
  return false;
}

export function computeMovingAverages(closes: readonly number[]): MovingAveragesResult {
  const sma50: number[] = sma({ period: 50, values: closes as number[] });
  const sma100: number[] = sma({ period: 100, values: closes as number[] });
  const sma200: number[] = sma({ period: 200, values: closes as number[] });
  const lastSma50: number = sma50[sma50.length - 1];
  const lastSma100: number = sma100[sma100.length - 1];
  const lastSma200: number = sma200[sma200.length - 1];
  if (![lastSma50, lastSma100, lastSma200].every(Number.isFinite)) {
    throw new AnalysisComputationError('SMA outputs incomplete — insufficient overlapping history.');
  }
  return {
    sma50,
    sma100,
    sma200,
    sma50SlopeLabel: slopeLabelFromLast10Sma(sma50),
    sma100SlopeLabel: slopeLabelFromLast10Sma(sma100),
    sma200SlopeLabel: slopeLabelFromLast10Sma(sma200),
    goldenCrossInLast20Sessions: detectCrossLast20(sma50, sma200, 'golden'),
    deathCrossInLast20Sessions: detectCrossLast20(sma50, sma200, 'death'),
  };
}
