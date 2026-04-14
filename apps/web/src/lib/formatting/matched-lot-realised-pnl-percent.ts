/** Realised P/L as % of matched cost (qty × buy unit price). */
export function formatMatchedLotRealisedPnlPercent(input: {
  readonly matchedQuantity: string;
  readonly buyUnitPrice: string;
  readonly realisedPnlAmount: string;
}): string | null {
  const qty: number = Number.parseFloat(input.matchedQuantity);
  const buy: number = Number.parseFloat(input.buyUnitPrice);
  const pnl: number = Number.parseFloat(input.realisedPnlAmount);
  if (!Number.isFinite(qty) || !Number.isFinite(buy) || !Number.isFinite(pnl)) {
    return null;
  }
  const cost: number = qty * buy;
  if (cost === 0) {
    return null;
  }
  return `${((pnl / cost) * 100).toFixed(2)}`;
}
