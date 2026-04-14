import { Decimal } from 'decimal.js';
import type { PerformanceSnapshotRecord } from '../snapshots/performance-snapshot-repository.js';
import { addUtcMonthsYmd } from '../snapshots/snapshot-date-utils.js';
import { getTwrDailyV1Metadata } from '../performance/twr-daily-v1.js';

export type TwrWindowValues = {
  readonly '1m': number | null;
  readonly '3m': number | null;
  readonly ytd: number | null;
  readonly '1y': number | null;
  readonly all: number | null;
  readonly calculation_method: string;
};

function parseYmd(input: { readonly ymd: string }): { readonly y: number; readonly m: number; readonly d: number } {
  const parts: string[] = input.ymd.split('-');
  return {
    y: Number.parseInt(parts[0] ?? '0', 10),
    m: Number.parseInt(parts[1] ?? '1', 10),
    d: Number.parseInt(parts[2] ?? '1', 10),
  };
}

function ytdStartYmd(input: { readonly asOfYmd: string }): string {
  const { y } = parseYmd({ ymd: input.asOfYmd });
  return `${String(y).padStart(4, '0')}-01-01`;
}

function findLatestRowOnOrBefore(input: {
  readonly rows: readonly PerformanceSnapshotRecord[];
  readonly onOrBeforeYmd: string;
}): PerformanceSnapshotRecord | undefined {
  let best: PerformanceSnapshotRecord | undefined;
  for (const row of input.rows) {
    if (row.periodDate <= input.onOrBeforeYmd) {
      if (best === undefined || row.periodDate > best.periodDate) {
        best = row;
      }
    }
  }
  return best;
}

function linkedReturnBetween(input: { readonly start: PerformanceSnapshotRecord; readonly end: PerformanceSnapshotRecord }): number | null {
  if (input.start.periodDate >= input.end.periodDate) {
    return null;
  }
  const endFactor: Decimal = new Decimal(1).add(input.end.cumulativeTwrReturn);
  const startFactor: Decimal = new Decimal(1).add(input.start.cumulativeTwrReturn);
  if (startFactor.lte(0) || endFactor.lte(0)) {
    return null;
  }
  return endFactor.div(startFactor).sub(1).toNumber();
}

/**
 * Derives rolling / window TWR figures from daily cumulative TWR rows (chain from portfolio inception).
 */
export function computeTwrWindowsForAnalytics(input: {
  readonly rows: readonly PerformanceSnapshotRecord[];
  readonly asOfYmd: string;
}): TwrWindowValues {
  const meta = getTwrDailyV1Metadata();
  const sorted: PerformanceSnapshotRecord[] = input.rows.slice().sort((a, b) => a.periodDate.localeCompare(b.periodDate));
  if (sorted.length === 0) {
    return { '1m': null, '3m': null, ytd: null, '1y': null, all: null, calculation_method: meta.calculationMethod };
  }
  const endRow: PerformanceSnapshotRecord | undefined = findLatestRowOnOrBefore({ rows: sorted, onOrBeforeYmd: input.asOfYmd });
  if (endRow === undefined) {
    return { '1m': null, '3m': null, ytd: null, '1y': null, all: null, calculation_method: meta.calculationMethod };
  }
  const all: number = new Decimal(endRow.cumulativeTwrReturn).toNumber();
  const oneMonthStart: string = addUtcMonthsYmd({ ymd: input.asOfYmd, months: -1 });
  const threeMonthStart: string = addUtcMonthsYmd({ ymd: input.asOfYmd, months: -3 });
  const oneYearStart: string = addUtcMonthsYmd({ ymd: input.asOfYmd, months: -12 });
  const ytdStart: string = ytdStartYmd({ asOfYmd: input.asOfYmd });
  const start1m: PerformanceSnapshotRecord | undefined = findLatestRowOnOrBefore({ rows: sorted, onOrBeforeYmd: oneMonthStart });
  const start3m: PerformanceSnapshotRecord | undefined = findLatestRowOnOrBefore({ rows: sorted, onOrBeforeYmd: threeMonthStart });
  const start1y: PerformanceSnapshotRecord | undefined = findLatestRowOnOrBefore({ rows: sorted, onOrBeforeYmd: oneYearStart });
  const startYtd: PerformanceSnapshotRecord | undefined = findLatestRowOnOrBefore({ rows: sorted, onOrBeforeYmd: ytdStart });
  return {
    '1m': start1m === undefined ? null : linkedReturnBetween({ start: start1m, end: endRow }),
    '3m': start3m === undefined ? null : linkedReturnBetween({ start: start3m, end: endRow }),
    ytd: startYtd === undefined || startYtd.periodDate >= endRow.periodDate ? null : linkedReturnBetween({ start: startYtd, end: endRow }),
    '1y': start1y === undefined ? null : linkedReturnBetween({ start: start1y, end: endRow }),
    all,
    calculation_method: meta.calculationMethod,
  };
}
