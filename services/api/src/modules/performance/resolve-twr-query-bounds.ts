import { addUtcMonthsYmd } from '../snapshots/snapshot-date-utils.js';

export type TwrQueryBounds =
  | { readonly ok: true; readonly fromInclusive?: string; readonly toInclusive?: string }
  | { readonly ok: false; readonly message: string };

const RANGE_PRESETS: ReadonlySet<string> = new Set(['ALL', '1M', '3M', 'YTD', '1Y']);

/**
 * Resolves TWR list filters: optional calendar presets vs explicit from/to (mutually exclusive).
 * Bounds are inclusive ISO dates (YYYY-MM-DD), aligned with `periodDate` on performance rows.
 */
export function resolveTwrQueryBounds(input: {
  readonly range: string | undefined;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly todayYmd: string;
}): TwrQueryBounds {
  const hasFromTo: boolean = input.from !== undefined || input.to !== undefined;
  if (input.range !== undefined && input.range.length > 0) {
    if (hasFromTo) {
      return { ok: false, message: 'Cannot combine range with from or to' };
    }
    const preset: string = input.range.toUpperCase();
    if (!RANGE_PRESETS.has(preset)) {
      return { ok: false, message: 'Invalid range (use ALL, 1M, 3M, YTD, 1Y)' };
    }
    if (preset === 'ALL') {
      return { ok: true };
    }
    const toInclusive: string = input.todayYmd;
    let fromInclusive: string;
    if (preset === '1M') {
      fromInclusive = addUtcMonthsYmd({ ymd: toInclusive, months: -1 });
    } else if (preset === '3M') {
      fromInclusive = addUtcMonthsYmd({ ymd: toInclusive, months: -3 });
    } else if (preset === 'YTD') {
      fromInclusive = `${toInclusive.slice(0, 4)}-01-01`;
    } else {
      fromInclusive = addUtcMonthsYmd({ ymd: toInclusive, months: -12 });
    }
    if (fromInclusive > toInclusive) {
      fromInclusive = toInclusive;
    }
    return { ok: true, fromInclusive, toInclusive };
  }
  return { ok: true, fromInclusive: input.from, toInclusive: input.to };
}
