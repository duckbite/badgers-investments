import { describe, expect, it } from 'vitest';
import { FifoHoldingsService } from './fifo-holdings-service.js';
import type { TransactionRecord } from './transaction-repository.js';

function baseTxn(input: Partial<TransactionRecord> & Pick<TransactionRecord, 'transactionId' | 'transactionType' | 'assetId'>): TransactionRecord {
  return {
    portfolioId: 'pf1',
    tradeDate: '2025-01-01',
    tradeTimestampIso: undefined,
    quantity: undefined,
    unitPrice: undefined,
    grossAmount: undefined,
    feeAmount: undefined,
    currencyCode: 'USD',
    notes: undefined,
    adjustmentSide: undefined,
    isDeleted: false,
    deletedAtIso: undefined,
    createdAtIso: '2025-01-01T00:00:00.000Z',
    updatedAtIso: '2025-01-01T00:00:00.000Z',
    createdByUserId: 'u1',
    ...input,
  };
}

describe('FifoHoldingsService', () => {
  it('matches FIFO for a sell after a buy', () => {
    const service: FifoHoldingsService = new FifoHoldingsService();
    const txs: TransactionRecord[] = [
      baseTxn({
        transactionId: 't1',
        transactionType: 'BUY',
        assetId: 'a1',
        quantity: '10',
        unitPrice: '100',
        feeAmount: '0',
      }),
      baseTxn({
        transactionId: 't2',
        transactionType: 'SELL',
        assetId: 'a1',
        tradeDate: '2025-01-02',
        quantity: '4',
        unitPrice: '110',
        feeAmount: '0',
      }),
    ];
    const result = service.compute({ transactions: txs, nowIso: '2025-01-02T00:00:00.000Z' });
    const position = result.positions.find((p) => p.assetId === 'a1');
    expect(position?.quantityHeld).toBe('6');
    expect(result.lotLinks).toHaveLength(1);
    expect(result.lotLinks[0]?.matchedQuantity).toBe('4');
    expect(result.lotLinks[0]?.buyUnitPrice).toBe('100');
    expect(result.lotLinks[0]?.sellUnitPrice).toBe('110');
  });
});
