/** Portfolio allocation and similar API strings are on a 0–100 scale. */
export function formatPortfolioAllocationPercent(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    return '—';
  }
  const n: number = Number.parseFloat(raw);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return `${n.toFixed(2)}%`;
}

/** TWR and similar rates are decimals (e.g. 0.0123 → 1.23%). */
export function formatUnitRateAsPercent2(raw: string): string {
  const n: number = Number.parseFloat(raw);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return `${(n * 100).toFixed(2)}%`;
}

export function formatNumberAsPercent2(n: number): string {
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toFixed(2)}%`;
}
