import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import type { LotLinkWrite } from './lot-link-repository.js';
import type { TransactionRecord, TransactionType } from './transaction-repository.js';

export type PositionRow = {
  readonly assetId: string;
  readonly quantityHeld: string;
  readonly costBasisRemaining: string;
  readonly realisedPnlAmount: string;
  readonly currencyCode: string;
};

export type FifoComputation = {
  readonly positions: readonly PositionRow[];
  readonly lotLinks: readonly LotLinkWrite[];
};

type InternalLot = {
  readonly buyTransactionId: string;
  quantityRemaining: Decimal;
  readonly unitCost: Decimal;
};

export class FifoHoldingsService {
  public compute(input: {
    readonly transactions: readonly TransactionRecord[];
    readonly nowIso: string;
  }): FifoComputation {
    const active: TransactionRecord[] = input.transactions
      .filter((row) => !row.isDeleted)
      .slice()
      .sort(compareTransactionsForReplay);
    const lotsByAsset: Map<string, InternalLot[]> = new Map();
    const positions: Map<string, { quantity: Decimal; costBasis: Decimal; realised: Decimal; currency: string }> = new Map();
    const lotLinks: LotLinkWrite[] = [];
    for (const tx of active) {
      if (!positions.has(tx.assetId)) {
        positions.set(tx.assetId, {
          quantity: new Decimal(0),
          costBasis: new Decimal(0),
          realised: new Decimal(0),
          currency: tx.currencyCode,
        });
      }
      const position = positions.get(tx.assetId);
      if (position === undefined) {
        continue;
      }
      applyTransaction({
        tx,
        lotsByAsset,
        position,
        lotLinks,
        nowIso: input.nowIso,
      });
    }
    for (const [assetId, value] of positions.entries()) {
      if (value.quantity.lt(0) || value.costBasis.lt(0)) {
        throw new FifoValidationError({
          code: 'LEDGER_NEGATIVE_HOLDINGS',
          message: `Negative holdings are not allowed (asset ${assetId}).`,
        });
      }
    }
    const positionRows: PositionRow[] = [...positions.entries()].map(([assetId, value]) => ({
      assetId,
      quantityHeld: value.quantity.toFixed(),
      costBasisRemaining: value.costBasis.toFixed(),
      realisedPnlAmount: value.realised.toFixed(),
      currencyCode: value.currency,
    }));
    return { positions: positionRows, lotLinks };
  }
}

function compareTransactionsForReplay(left: TransactionRecord, right: TransactionRecord): number {
  const dateCompare: number = left.tradeDate.localeCompare(right.tradeDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }
  const leftTs: string = left.tradeTimestampIso ?? `${left.tradeDate}T00:00:00.000Z`;
  const rightTs: string = right.tradeTimestampIso ?? `${right.tradeDate}T00:00:00.000Z`;
  const tsCompare: number = leftTs.localeCompare(rightTs);
  if (tsCompare !== 0) {
    return tsCompare;
  }
  const createdCompare: number = left.createdAtIso.localeCompare(right.createdAtIso);
  if (createdCompare !== 0) {
    return createdCompare;
  }
  return left.transactionId.localeCompare(right.transactionId);
}

function applyTransaction(input: {
  readonly tx: TransactionRecord;
  readonly lotsByAsset: Map<string, InternalLot[]>;
  readonly position: { quantity: Decimal; costBasis: Decimal; realised: Decimal; currency: string };
  readonly lotLinks: LotLinkWrite[];
  readonly nowIso: string;
}): void {
  const tx: TransactionRecord = input.tx;
  const type: TransactionType = tx.transactionType;
  if (type === 'BUY') {
    applyBuy({ tx, lotsByAsset: input.lotsByAsset, position: input.position });
    return;
  }
  if (type === 'SELL') {
    applySell({ tx, lotsByAsset: input.lotsByAsset, position: input.position, lotLinks: input.lotLinks, nowIso: input.nowIso });
    return;
  }
  if (type === 'ADJUSTMENT') {
    applyAdjustment({ tx, lotsByAsset: input.lotsByAsset, position: input.position });
    return;
  }
  if (type === 'DIVIDEND' || type === 'INTEREST') {
    const gross: Decimal = requirePositiveDecimal({ raw: tx.grossAmount, label: 'grossAmount' });
    input.position.realised = input.position.realised.add(gross);
    return;
  }
  if (type === 'FEE') {
    const gross: Decimal = requirePositiveDecimal({ raw: tx.grossAmount, label: 'grossAmount' });
    input.position.realised = input.position.realised.sub(gross);
    return;
  }
}

function applyBuy(input: {
  readonly tx: TransactionRecord;
  readonly lotsByAsset: Map<string, InternalLot[]>;
  readonly position: { quantity: Decimal; costBasis: Decimal; realised: Decimal; currency: string };
}): void {
  const tx: TransactionRecord = input.tx;
  const quantity: Decimal = requirePositiveDecimal({ raw: tx.quantity, label: 'quantity' });
  const unitPrice: Decimal = requireNonNegativeDecimal({ raw: tx.unitPrice, label: 'unitPrice' });
  const fee: Decimal = tx.feeAmount === undefined ? new Decimal(0) : requireNonNegativeDecimal({ raw: tx.feeAmount, label: 'feeAmount' });
  const grossCost: Decimal = quantity.mul(unitPrice).add(fee);
  const unitCost: Decimal = quantity.gt(0) ? grossCost.div(quantity) : new Decimal(0);
  const queue: InternalLot[] = input.lotsByAsset.get(tx.assetId) ?? [];
  queue.push({ buyTransactionId: tx.transactionId, quantityRemaining: quantity, unitCost });
  input.lotsByAsset.set(tx.assetId, queue);
  input.position.quantity = input.position.quantity.add(quantity);
  input.position.costBasis = input.position.costBasis.add(grossCost);
}

function applySell(input: {
  readonly tx: TransactionRecord;
  readonly lotsByAsset: Map<string, InternalLot[]>;
  readonly position: { quantity: Decimal; costBasis: Decimal; realised: Decimal; currency: string };
  readonly lotLinks: LotLinkWrite[];
  readonly nowIso: string;
}): void {
  const tx: TransactionRecord = input.tx;
  const quantity: Decimal = requirePositiveDecimal({ raw: tx.quantity, label: 'quantity' });
  const unitPrice: Decimal = requireNonNegativeDecimal({ raw: tx.unitPrice, label: 'unitPrice' });
  const sellFee: Decimal = tx.feeAmount === undefined ? new Decimal(0) : requireNonNegativeDecimal({ raw: tx.feeAmount, label: 'feeAmount' });
  let remaining: Decimal = quantity;
  const queue: InternalLot[] = input.lotsByAsset.get(tx.assetId) ?? [];
  let realised: Decimal = new Decimal(0);
  let totalCostRemoved: Decimal = new Decimal(0);
  while (remaining.gt(0)) {
    const front: InternalLot | undefined = queue[0];
    if (front === undefined) {
      throw new FifoValidationError({ code: 'LEDGER_INSUFFICIENT_LOTS', message: 'Sell exceeds available lots for FIFO matching.' });
    }
    const matched: Decimal = Decimal.min(remaining, front.quantityRemaining);
    const cost: Decimal = matched.mul(front.unitCost);
    totalCostRemoved = totalCostRemoved.add(cost);
    const proceeds: Decimal = matched.mul(unitPrice);
    const feeShare: Decimal = quantity.gt(0) ? sellFee.mul(matched).div(quantity) : new Decimal(0);
    const pnl: Decimal = proceeds.sub(cost).sub(feeShare);
    realised = realised.add(pnl);
    input.lotLinks.push({
      linkId: randomUUID(),
      sellTransactionId: tx.transactionId,
      buyTransactionId: front.buyTransactionId,
      matchedQuantity: matched.toFixed(),
      buyUnitPrice: front.unitCost.toFixed(),
      sellUnitPrice: unitPrice.toFixed(),
      realisedPnlAmount: pnl.toFixed(),
      currencyCode: tx.currencyCode,
      createdAtIso: input.nowIso,
    });
    front.quantityRemaining = front.quantityRemaining.sub(matched);
    if (front.quantityRemaining.lte(0)) {
      queue.shift();
    }
    remaining = remaining.sub(matched);
  }
  input.lotsByAsset.set(tx.assetId, queue);
  input.position.quantity = input.position.quantity.sub(quantity);
  input.position.costBasis = input.position.costBasis.sub(totalCostRemoved);
  input.position.realised = input.position.realised.add(realised);
}

function applyAdjustment(input: {
  readonly tx: TransactionRecord;
  readonly lotsByAsset: Map<string, InternalLot[]>;
  readonly position: { quantity: Decimal; costBasis: Decimal; realised: Decimal; currency: string };
}): void {
  const tx: TransactionRecord = input.tx;
  const side = tx.adjustmentSide;
  if (side === undefined) {
    throw new FifoValidationError({ code: 'LEDGER_ADJUSTMENT_SIDE_REQUIRED', message: 'adjustmentSide is required for ADJUSTMENT.' });
  }
  const quantity: Decimal = requirePositiveDecimal({ raw: tx.quantity, label: 'quantity' });
  if (side === 'INCREASE') {
    const unitPrice: Decimal = requireNonNegativeDecimal({ raw: tx.unitPrice, label: 'unitPrice' });
    const fee: Decimal = tx.feeAmount === undefined ? new Decimal(0) : requireNonNegativeDecimal({ raw: tx.feeAmount, label: 'feeAmount' });
    const grossCost: Decimal = quantity.mul(unitPrice).add(fee);
    const unitCost: Decimal = quantity.gt(0) ? grossCost.div(quantity) : new Decimal(0);
    const queue: InternalLot[] = input.lotsByAsset.get(tx.assetId) ?? [];
    queue.push({ buyTransactionId: tx.transactionId, quantityRemaining: quantity, unitCost });
    input.lotsByAsset.set(tx.assetId, queue);
    input.position.quantity = input.position.quantity.add(quantity);
    input.position.costBasis = input.position.costBasis.add(grossCost);
    return;
  }
  let remaining: Decimal = quantity;
  const queue: InternalLot[] = input.lotsByAsset.get(tx.assetId) ?? [];
  let totalCostRemoved: Decimal = new Decimal(0);
  while (remaining.gt(0)) {
    const front: InternalLot | undefined = queue[0];
    if (front === undefined) {
      throw new FifoValidationError({ code: 'LEDGER_INSUFFICIENT_LOTS', message: 'Adjustment decrease exceeds available lots.' });
    }
    const matched: Decimal = Decimal.min(remaining, front.quantityRemaining);
    const cost: Decimal = matched.mul(front.unitCost);
    totalCostRemoved = totalCostRemoved.add(cost);
    front.quantityRemaining = front.quantityRemaining.sub(matched);
    if (front.quantityRemaining.lte(0)) {
      queue.shift();
    }
    remaining = remaining.sub(matched);
  }
  input.lotsByAsset.set(tx.assetId, queue);
  input.position.quantity = input.position.quantity.sub(quantity);
  input.position.costBasis = input.position.costBasis.sub(totalCostRemoved);
}

export class FifoValidationError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

function requirePositiveDecimal(input: { readonly raw: string | undefined; readonly label: string }): Decimal {
  if (input.raw === undefined) {
    throw new FifoValidationError({ code: 'LEDGER_AMOUNT_REQUIRED', message: `${input.label} is required.` });
  }
  const value: Decimal = new Decimal(input.raw);
  if (!value.isFinite() || value.lte(0)) {
    throw new FifoValidationError({ code: 'LEDGER_AMOUNT_INVALID', message: `${input.label} must be positive.` });
  }
  return value;
}

function requireNonNegativeDecimal(input: { readonly raw: string | undefined; readonly label: string }): Decimal {
  if (input.raw === undefined) {
    throw new FifoValidationError({ code: 'LEDGER_AMOUNT_REQUIRED', message: `${input.label} is required.` });
  }
  const value: Decimal = new Decimal(input.raw);
  if (!value.isFinite() || value.lt(0)) {
    throw new FifoValidationError({ code: 'LEDGER_AMOUNT_INVALID', message: `${input.label} must be non-negative.` });
  }
  return value;
}
