import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { isAllowedCurrencyCode, normalizeCurrencyCode } from '../domain/currency-codes.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import type { AssetService } from '../assets/asset-service.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import { FifoHoldingsService, FifoValidationError } from './fifo-holdings-service.js';
import type { LotLinkRepository } from './lot-link-repository.js';
import type { AdjustmentSide, TransactionRecord, TransactionRepository, TransactionType } from './transaction-repository.js';

export type TransactionDto = {
  readonly transactionId: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly transactionType: TransactionType;
  readonly tradeDate: string;
  readonly tradeTimestamp: string | undefined;
  readonly quantity: string | undefined;
  readonly unitPrice: string | undefined;
  readonly grossAmount: string | undefined;
  readonly feeAmount: string | undefined;
  readonly currencyCode: string;
  readonly notes: string | undefined;
  readonly adjustmentSide: AdjustmentSide | undefined;
  readonly isDeleted: boolean;
  readonly deletedAt: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserId: string;
};

export class LedgerService {
  private readonly transactionRepository: TransactionRepository;
  private readonly lotLinkRepository: LotLinkRepository;
  private readonly portfolioService: PortfolioService;
  private readonly assetService: AssetService;
  private readonly fifoHoldingsService: FifoHoldingsService;

  public constructor(input: {
    readonly transactionRepository: TransactionRepository;
    readonly lotLinkRepository: LotLinkRepository;
    readonly portfolioService: PortfolioService;
    readonly assetService: AssetService;
    readonly fifoHoldingsService: FifoHoldingsService;
  }) {
    this.transactionRepository = input.transactionRepository;
    this.lotLinkRepository = input.lotLinkRepository;
    this.portfolioService = input.portfolioService;
    this.assetService = input.assetService;
    this.fifoHoldingsService = input.fifoHoldingsService;
  }

  public async listTransactions(input: {
    readonly userId: string;
    readonly assetId: string | undefined;
    readonly includeDeleted: boolean;
    readonly now: Date;
  }): Promise<readonly TransactionDto[]> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const rows: readonly TransactionRecord[] = await this.transactionRepository.listByPortfolio({
      userId: input.userId,
      portfolioId,
    });
    const sorted: TransactionRecord[] = rows.slice().sort(compareTransactionsForApi);
    const filtered: TransactionRecord[] = sorted.filter((row) => {
      if (!input.includeDeleted && row.isDeleted) {
        return false;
      }
      if (input.assetId !== undefined && row.assetId !== input.assetId) {
        return false;
      }
      return true;
    });
    return filtered.map((row) => toDto({ record: row }));
  }

  public async createTransaction(input: {
    readonly userId: string;
    readonly body: TransactionWriteBody;
    readonly now: Date;
  }): Promise<TransactionDto> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const asset: AssetRecord | undefined = await this.assetService.getById({
      userId: input.userId,
      assetId: input.body.assetId,
      now: input.now,
    });
    if (asset === undefined || asset.portfolioId !== portfolioId) {
      throw new LedgerValidationError({ code: 'LEDGER_ASSET_NOT_FOUND', message: 'Asset not found for this portfolio.' });
    }
    const transactionId: string = randomUUID();
    const createdAtIso: string = input.now.toISOString();
    const normalized: NormalizedTransactionFields = normalizeTransactionFields({
      body: input.body,
      assetCurrency: asset.currencyCode,
    });
    validateTransactionSemantics({ normalized });
    await validateAgainstLedger({
      fifoHoldingsService: this.fifoHoldingsService,
      transactionRepository: this.transactionRepository,
      userId: input.userId,
      portfolioId,
      mode: 'create',
      candidate: {
        transactionId,
        portfolioId,
        assetId: input.body.assetId,
        transactionType: normalized.transactionType,
        tradeDate: normalized.tradeDate,
        tradeTimestampIso: normalized.tradeTimestampIso,
        quantity: normalized.quantity,
        unitPrice: normalized.unitPrice,
        grossAmount: normalized.grossAmount,
        feeAmount: normalized.feeAmount,
        currencyCode: normalized.currencyCode,
        notes: normalized.notes,
        adjustmentSide: normalized.adjustmentSide,
        isDeleted: false,
        deletedAtIso: undefined,
        createdAtIso,
        updatedAtIso: createdAtIso,
        createdByUserId: input.userId,
      },
    });
    await this.transactionRepository.create({
      userId: input.userId,
      portfolioId,
      transactionId,
      assetId: input.body.assetId,
      transactionType: normalized.transactionType,
      tradeDate: normalized.tradeDate,
      tradeTimestampIso: normalized.tradeTimestampIso,
      quantity: normalized.quantity,
      unitPrice: normalized.unitPrice,
      grossAmount: normalized.grossAmount,
      feeAmount: normalized.feeAmount,
      currencyCode: normalized.currencyCode,
      notes: normalized.notes,
      adjustmentSide: normalized.adjustmentSide,
      createdAtIso,
      createdByUserId: input.userId,
    });
    await this.recomputeFifo({ userId: input.userId, portfolioId, nowIso: createdAtIso });
    const created: TransactionRecord | undefined = await this.transactionRepository.getById({
      userId: input.userId,
      portfolioId,
      transactionId,
    });
    if (created === undefined) {
      throw new Error('Transaction create failed unexpectedly.');
    }
    return toDto({ record: created });
  }

  public async updateTransaction(input: {
    readonly userId: string;
    readonly transactionId: string;
    readonly body: TransactionPatchBody;
    readonly now: Date;
  }): Promise<TransactionDto | undefined> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const existing: TransactionRecord | undefined = await this.transactionRepository.getById({
      userId: input.userId,
      portfolioId,
      transactionId: input.transactionId,
    });
    if (existing === undefined || existing.isDeleted) {
      return undefined;
    }
    const nextAssetId: string = input.body.assetId ?? existing.assetId;
    const asset: AssetRecord | undefined = await this.assetService.getById({ userId: input.userId, assetId: nextAssetId, now: input.now });
    if (asset === undefined || asset.portfolioId !== portfolioId) {
      throw new LedgerValidationError({ code: 'LEDGER_ASSET_NOT_FOUND', message: 'Asset not found for this portfolio.' });
    }
    const merged: TransactionRecord = mergeTransactionRecord({
      existing,
      patch: input.body,
      assetCurrency: asset.currencyCode,
    });
    const updatedAtIso: string = input.now.toISOString();
    validateTransactionSemantics({
      normalized: {
        transactionType: merged.transactionType,
        tradeDate: merged.tradeDate,
        tradeTimestampIso: merged.tradeTimestampIso,
        quantity: merged.quantity,
        unitPrice: merged.unitPrice,
        grossAmount: merged.grossAmount,
        feeAmount: merged.feeAmount,
        currencyCode: merged.currencyCode,
        notes: merged.notes,
        adjustmentSide: merged.adjustmentSide,
      },
    });
    await validateAgainstLedger({
      fifoHoldingsService: this.fifoHoldingsService,
      transactionRepository: this.transactionRepository,
      userId: input.userId,
      portfolioId,
      mode: 'replace',
      candidate: {
        ...merged,
        updatedAtIso,
      },
    });
    await this.transactionRepository.update({
      userId: input.userId,
      portfolioId,
      transactionId: input.transactionId,
      assetId: merged.assetId,
      tradeDate: merged.tradeDate,
      tradeTimestampIso: merged.tradeTimestampIso,
      quantity: merged.quantity,
      unitPrice: merged.unitPrice,
      grossAmount: merged.grossAmount,
      feeAmount: merged.feeAmount,
      currencyCode: merged.currencyCode,
      notes: merged.notes,
      adjustmentSide: merged.adjustmentSide,
      updatedAtIso,
    });
    await this.recomputeFifo({ userId: input.userId, portfolioId, nowIso: updatedAtIso });
    const refreshed: TransactionRecord | undefined = await this.transactionRepository.getById({
      userId: input.userId,
      portfolioId,
      transactionId: input.transactionId,
    });
    if (refreshed === undefined) {
      return undefined;
    }
    return toDto({ record: refreshed });
  }

  public async softDeleteTransaction(input: {
    readonly userId: string;
    readonly transactionId: string;
    readonly now: Date;
  }): Promise<TransactionDto | undefined> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const existing: TransactionRecord | undefined = await this.transactionRepository.getById({
      userId: input.userId,
      portfolioId,
      transactionId: input.transactionId,
    });
    if (existing === undefined || existing.isDeleted) {
      return undefined;
    }
    const updatedAtIso: string = input.now.toISOString();
    const deletedAtIso: string = input.now.toISOString();
    await this.transactionRepository.softDelete({
      userId: input.userId,
      portfolioId,
      transactionId: input.transactionId,
      deletedAtIso,
      updatedAtIso,
    });
    await this.recomputeFifo({ userId: input.userId, portfolioId, nowIso: updatedAtIso });
    const refreshed: TransactionRecord | undefined = await this.transactionRepository.getById({
      userId: input.userId,
      portfolioId,
      transactionId: input.transactionId,
    });
    if (refreshed === undefined) {
      return undefined;
    }
    return toDto({ record: refreshed });
  }

  public async getHoldings(input: { readonly userId: string; readonly now: Date }): Promise<{
    readonly holdings: ReturnType<FifoHoldingsService['compute']>['positions'];
    readonly lotLinks: ReturnType<FifoHoldingsService['compute']>['lotLinks'];
  }> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const rows: readonly TransactionRecord[] = await this.transactionRepository.listByPortfolio({
      userId: input.userId,
      portfolioId,
    });
    const nowIso: string = input.now.toISOString();
    const computation = this.fifoHoldingsService.compute({ transactions: rows, nowIso });
    return { holdings: computation.positions, lotLinks: computation.lotLinks };
  }

  private async recomputeFifo(input: { readonly userId: string; readonly portfolioId: string; readonly nowIso: string }): Promise<void> {
    const rows: readonly TransactionRecord[] = await this.transactionRepository.listByPortfolio({
      userId: input.userId,
      portfolioId: input.portfolioId,
    });
    const computation = this.fifoHoldingsService.compute({ transactions: rows, nowIso: input.nowIso });
    await this.lotLinkRepository.replaceAll({
      userId: input.userId,
      portfolioId: input.portfolioId,
      links: computation.lotLinks,
    });
  }
}

export type TransactionWriteBody = {
  readonly assetId: string;
  readonly transactionType: TransactionType;
  readonly tradeDate: string;
  readonly tradeTimestamp: string | undefined;
  readonly quantity: string | undefined;
  readonly unitPrice: string | undefined;
  readonly grossAmount: string | undefined;
  readonly feeAmount: string | undefined;
  readonly currencyCode: string;
  readonly notes: string | undefined;
  readonly adjustmentSide: AdjustmentSide | undefined;
};

export type TransactionPatchBody = {
  readonly assetId: string | undefined;
  readonly tradeDate: string | undefined;
  readonly tradeTimestamp: string | undefined;
  readonly quantity: string | undefined;
  readonly unitPrice: string | undefined;
  readonly grossAmount: string | undefined;
  readonly feeAmount: string | undefined;
  readonly currencyCode: string | undefined;
  readonly notes: string | undefined;
  readonly adjustmentSide: AdjustmentSide | undefined;
};

export class LedgerValidationError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

type NormalizedTransactionFields = {
  readonly transactionType: TransactionType;
  readonly tradeDate: string;
  readonly tradeTimestampIso: string | undefined;
  readonly quantity: string | undefined;
  readonly unitPrice: string | undefined;
  readonly grossAmount: string | undefined;
  readonly feeAmount: string | undefined;
  readonly currencyCode: string;
  readonly notes: string | undefined;
  readonly adjustmentSide: AdjustmentSide | undefined;
};

function normalizeTransactionFields(input: { readonly body: TransactionWriteBody; readonly assetCurrency: string }): NormalizedTransactionFields {
  if (!isIsoDate({ raw: input.body.tradeDate })) {
    throw new LedgerValidationError({ code: 'LEDGER_TRADE_DATE_INVALID', message: 'tradeDate must be YYYY-MM-DD.' });
  }
  const currencyCode: string = normalizeCurrencyCode({ raw: input.body.currencyCode });
  if (!isAllowedCurrencyCode({ raw: currencyCode })) {
    throw new LedgerValidationError({ code: 'LEDGER_CURRENCY_INVALID', message: 'currencyCode is not allowed.' });
  }
  if (currencyCode !== normalizeCurrencyCode({ raw: input.assetCurrency })) {
    throw new LedgerValidationError({ code: 'LEDGER_CURRENCY_MISMATCH', message: 'Transaction currency must match asset currency.' });
  }
  const feeAmount: string | undefined =
    input.body.feeAmount === undefined ? undefined : new Decimal(input.body.feeAmount).toFixed();
  const quantity: string | undefined = input.body.quantity === undefined ? undefined : new Decimal(input.body.quantity).toFixed();
  const unitPrice: string | undefined = input.body.unitPrice === undefined ? undefined : new Decimal(input.body.unitPrice).toFixed();
  const grossAmount: string | undefined =
    input.body.grossAmount === undefined ? undefined : new Decimal(input.body.grossAmount).toFixed();
  const notes: string | undefined = input.body.notes;
  if (input.body.transactionType === 'ADJUSTMENT' && (notes === undefined || notes.trim().length === 0)) {
    throw new LedgerValidationError({ code: 'LEDGER_NOTES_REQUIRED', message: 'notes are required for ADJUSTMENT.' });
  }
  return {
    transactionType: input.body.transactionType,
    tradeDate: input.body.tradeDate,
    tradeTimestampIso: input.body.tradeTimestamp,
    quantity,
    unitPrice,
    grossAmount,
    feeAmount,
    currencyCode,
    notes,
    adjustmentSide: input.body.adjustmentSide,
  };
}

function mergeTransactionRecord(input: {
  readonly existing: TransactionRecord;
  readonly patch: TransactionPatchBody;
  readonly assetCurrency: string;
}): TransactionRecord {
  const nextCurrency: string =
    input.patch.currencyCode === undefined
      ? input.existing.currencyCode
      : normalizeCurrencyCode({ raw: input.patch.currencyCode });
  if (!isAllowedCurrencyCode({ raw: nextCurrency })) {
    throw new LedgerValidationError({ code: 'LEDGER_CURRENCY_INVALID', message: 'currencyCode is not allowed.' });
  }
  if (nextCurrency !== normalizeCurrencyCode({ raw: input.assetCurrency })) {
    throw new LedgerValidationError({ code: 'LEDGER_CURRENCY_MISMATCH', message: 'Transaction currency must match asset currency.' });
  }
  const transactionType: TransactionType = input.existing.transactionType;
  const tradeDate: string = input.patch.tradeDate ?? input.existing.tradeDate;
  if (!isIsoDate({ raw: tradeDate })) {
    throw new LedgerValidationError({ code: 'LEDGER_TRADE_DATE_INVALID', message: 'tradeDate must be YYYY-MM-DD.' });
  }
  const quantity: string | undefined =
    input.patch.quantity === undefined ? input.existing.quantity : new Decimal(input.patch.quantity).toFixed();
  const unitPrice: string | undefined =
    input.patch.unitPrice === undefined ? input.existing.unitPrice : new Decimal(input.patch.unitPrice).toFixed();
  const grossAmount: string | undefined =
    input.patch.grossAmount === undefined ? input.existing.grossAmount : new Decimal(input.patch.grossAmount).toFixed();
  const feeAmount: string | undefined =
    input.patch.feeAmount === undefined ? input.existing.feeAmount : new Decimal(input.patch.feeAmount).toFixed();
  const notes: string | undefined = input.patch.notes === undefined ? input.existing.notes : input.patch.notes;
  if (transactionType === 'ADJUSTMENT' && (notes === undefined || notes.trim().length === 0)) {
    throw new LedgerValidationError({ code: 'LEDGER_NOTES_REQUIRED', message: 'notes are required for ADJUSTMENT.' });
  }
  return {
    ...input.existing,
    assetId: input.patch.assetId ?? input.existing.assetId,
    tradeDate,
    tradeTimestampIso: input.patch.tradeTimestamp === undefined ? input.existing.tradeTimestampIso : input.patch.tradeTimestamp,
    quantity,
    unitPrice,
    grossAmount,
    feeAmount,
    currencyCode: nextCurrency,
    notes,
    adjustmentSide: input.patch.adjustmentSide === undefined ? input.existing.adjustmentSide : input.patch.adjustmentSide,
  };
}

async function validateAgainstLedger(input: {
  readonly fifoHoldingsService: FifoHoldingsService;
  readonly transactionRepository: TransactionRepository;
  readonly userId: string;
  readonly portfolioId: string;
  readonly mode: 'create' | 'replace';
  readonly candidate: TransactionRecord;
}): Promise<void> {
  const rows: readonly TransactionRecord[] = await input.transactionRepository.listByPortfolio({
    userId: input.userId,
    portfolioId: input.portfolioId,
  });
  try {
    if (input.mode === 'create') {
      const next: TransactionRecord[] = [...rows, input.candidate];
      input.fifoHoldingsService.compute({ transactions: next, nowIso: input.candidate.updatedAtIso });
      return;
    }
    const next: TransactionRecord[] = rows.map((row) =>
      row.transactionId === input.candidate.transactionId ? input.candidate : row,
    );
    input.fifoHoldingsService.compute({ transactions: next, nowIso: input.candidate.updatedAtIso });
  } catch (err) {
    if (err instanceof FifoValidationError) {
      throw new LedgerValidationError({ code: err.code, message: err.message });
    }
    throw err;
  }
}

function validateTransactionSemantics(input: { readonly normalized: NormalizedTransactionFields }): void {
  const type: TransactionType = input.normalized.transactionType;
  if (type === 'BUY' || type === 'SELL') {
    if (input.normalized.quantity === undefined || input.normalized.unitPrice === undefined) {
      throw new LedgerValidationError({ code: 'LEDGER_FIELDS_REQUIRED', message: 'quantity and unitPrice are required for BUY and SELL.' });
    }
    return;
  }
  if (type === 'DIVIDEND' || type === 'INTEREST' || type === 'FEE') {
    if (input.normalized.grossAmount === undefined) {
      throw new LedgerValidationError({ code: 'LEDGER_FIELDS_REQUIRED', message: 'grossAmount is required for DIVIDEND, INTEREST, and FEE.' });
    }
    return;
  }
  if (type === 'ADJUSTMENT') {
    if (input.normalized.quantity === undefined || input.normalized.adjustmentSide === undefined) {
      throw new LedgerValidationError({
        code: 'LEDGER_FIELDS_REQUIRED',
        message: 'quantity and adjustmentSide are required for ADJUSTMENT.',
      });
    }
    if (input.normalized.adjustmentSide === 'INCREASE' && input.normalized.unitPrice === undefined) {
      throw new LedgerValidationError({ code: 'LEDGER_FIELDS_REQUIRED', message: 'unitPrice is required for ADJUSTMENT INCREASE.' });
    }
  }
}

function compareTransactionsForApi(left: TransactionRecord, right: TransactionRecord): number {
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

function toDto(input: { readonly record: TransactionRecord }): TransactionDto {
  return {
    transactionId: input.record.transactionId,
    portfolioId: input.record.portfolioId,
    assetId: input.record.assetId,
    transactionType: input.record.transactionType,
    tradeDate: input.record.tradeDate,
    tradeTimestamp: input.record.tradeTimestampIso,
    quantity: input.record.quantity,
    unitPrice: input.record.unitPrice,
    grossAmount: input.record.grossAmount,
    feeAmount: input.record.feeAmount,
    currencyCode: input.record.currencyCode,
    notes: input.record.notes,
    adjustmentSide: input.record.adjustmentSide,
    isDeleted: input.record.isDeleted,
    deletedAt: input.record.deletedAtIso,
    createdAt: input.record.createdAtIso,
    updatedAt: input.record.updatedAtIso,
    createdByUserId: input.record.createdByUserId,
  };
}

function isIsoDate(input: { readonly raw: string }): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input.raw);
}
