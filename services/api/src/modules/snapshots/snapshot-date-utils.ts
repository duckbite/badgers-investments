import type { TransactionRecord } from '../ledger/transaction-repository.js';

export function utcCalendarDateYmd(input: { readonly instant: Date }): string {
  return input.instant.toISOString().slice(0, 10);
}

export function endOfUtcDayIso(input: { readonly dateYmd: string }): string {
  return `${input.dateYmd}T23:59:59.999Z`;
}

export function isTransactionIncludedAsOf(input: { readonly tx: TransactionRecord; readonly asOfDateYmd: string }): boolean {
  if (input.tx.isDeleted) {
    return false;
  }
  if (input.tx.tradeDate < input.asOfDateYmd) {
    return true;
  }
  if (input.tx.tradeDate > input.asOfDateYmd) {
    return false;
  }
  const ts: string = input.tx.tradeTimestampIso ?? `${input.tx.tradeDate}T00:00:00.000Z`;
  return ts <= endOfUtcDayIso({ dateYmd: input.asOfDateYmd });
}

export function minIsoDateString(input: { readonly dates: readonly string[] }): string | undefined {
  if (input.dates.length === 0) {
    return undefined;
  }
  return input.dates.slice().sort()[0];
}

export function iterateDateRangeInclusive(input: { readonly from: string; readonly to: string }): readonly string[] {
  if (input.from > input.to) {
    return [];
  }
  const out: string[] = [];
  let cursor: Date = parseUtcDate({ ymd: input.from });
  const end: Date = parseUtcDate({ ymd: input.to });
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor = addUtcDays({ instant: cursor, days: 1 });
  }
  return out;
}

function parseUtcDate(input: { readonly ymd: string }): Date {
  return new Date(`${input.ymd}T00:00:00.000Z`);
}

function addUtcDays(input: { readonly instant: Date; readonly days: number }): Date {
  const copy: Date = new Date(input.instant.getTime());
  copy.setUTCDate(copy.getUTCDate() + input.days);
  return copy;
}

/** Calendar-month shift on UTC YYYY-MM-DD (for performance range presets). */
export function addUtcMonthsYmd(input: { readonly ymd: string; readonly months: number }): string {
  const parts: string[] = input.ymd.split('-');
  const year: number = Number.parseInt(parts[0] ?? '0', 10);
  const monthIndex: number = Number.parseInt(parts[1] ?? '1', 10) - 1;
  const day: number = Number.parseInt(parts[2] ?? '1', 10);
  const shifted: Date = new Date(Date.UTC(year, monthIndex + input.months, day));
  return shifted.toISOString().slice(0, 10);
}
