import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioScopedPartitionKey, buildTransactionSortKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'INTEREST'
  | 'FEE'
  | 'ADJUSTMENT';

export type AdjustmentSide = 'INCREASE' | 'DECREASE';

export type TransactionRecord = {
  readonly transactionId: string;
  readonly portfolioId: string;
  readonly assetId: string;
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
  readonly isDeleted: boolean;
  readonly deletedAtIso: string | undefined;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly createdByUserId: string;
};

export class TransactionRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async listByPortfolio(input: { readonly userId: string; readonly portfolioId: string }): Promise<readonly TransactionRecord[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': 'TXN#',
        },
        ConsistentRead: true,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    const parsed: TransactionRecord[] = [];
    for (const item of items) {
      const record: TransactionRecord | undefined = parseTransactionRecord({ item });
      if (record !== undefined) {
        parsed.push(record);
      }
    }
    return parsed;
  }

  public async getById(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly transactionId: string;
  }): Promise<TransactionRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildTransactionSortKey({ transactionId: input.transactionId }),
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    return parseTransactionRecord({ item });
  }

  public async create(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly transactionId: string;
    readonly assetId: string;
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
    readonly createdAtIso: string;
    readonly createdByUserId: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildTransactionSortKey({ transactionId: input.transactionId }),
          entityType: 'TRANSACTION',
          transactionId: input.transactionId,
          portfolioId: input.portfolioId,
          assetId: input.assetId,
          transactionType: input.transactionType,
          tradeDate: input.tradeDate,
          tradeTimestamp: input.tradeTimestampIso,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          grossAmount: input.grossAmount,
          feeAmount: input.feeAmount,
          currencyCode: input.currencyCode,
          notes: input.notes,
          adjustmentSide: input.adjustmentSide,
          isDeleted: false,
          deletedAt: undefined,
          createdAt: input.createdAtIso,
          updatedAt: input.createdAtIso,
          createdByUserId: input.createdByUserId,
        },
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  public async update(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly transactionId: string;
    readonly assetId: string | undefined;
    readonly tradeDate: string | undefined;
    readonly tradeTimestampIso: string | undefined;
    readonly quantity: string | undefined;
    readonly unitPrice: string | undefined;
    readonly grossAmount: string | undefined;
    readonly feeAmount: string | undefined;
    readonly currencyCode: string | undefined;
    readonly notes: string | undefined;
    readonly adjustmentSide: AdjustmentSide | undefined;
    readonly updatedAtIso: string;
  }): Promise<void> {
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, unknown> = { ':updatedAt': input.updatedAtIso };
    const expressions: string[] = ['#updatedAt = :updatedAt'];
    if (input.assetId !== undefined) {
      names['#assetId'] = 'assetId';
      values[':assetId'] = input.assetId;
      expressions.push('#assetId = :assetId');
    }
    if (input.tradeDate !== undefined) {
      names['#tradeDate'] = 'tradeDate';
      values[':tradeDate'] = input.tradeDate;
      expressions.push('#tradeDate = :tradeDate');
    }
    if (input.tradeTimestampIso !== undefined) {
      names['#tradeTimestamp'] = 'tradeTimestamp';
      values[':tradeTimestamp'] = input.tradeTimestampIso;
      expressions.push('#tradeTimestamp = :tradeTimestamp');
    }
    if (input.quantity !== undefined) {
      names['#quantity'] = 'quantity';
      values[':quantity'] = input.quantity;
      expressions.push('#quantity = :quantity');
    }
    if (input.unitPrice !== undefined) {
      names['#unitPrice'] = 'unitPrice';
      values[':unitPrice'] = input.unitPrice;
      expressions.push('#unitPrice = :unitPrice');
    }
    if (input.grossAmount !== undefined) {
      names['#grossAmount'] = 'grossAmount';
      values[':grossAmount'] = input.grossAmount;
      expressions.push('#grossAmount = :grossAmount');
    }
    if (input.feeAmount !== undefined) {
      names['#feeAmount'] = 'feeAmount';
      values[':feeAmount'] = input.feeAmount;
      expressions.push('#feeAmount = :feeAmount');
    }
    if (input.currencyCode !== undefined) {
      names['#currencyCode'] = 'currencyCode';
      values[':currencyCode'] = input.currencyCode;
      expressions.push('#currencyCode = :currencyCode');
    }
    if (input.notes !== undefined) {
      names['#notes'] = 'notes';
      values[':notes'] = input.notes;
      expressions.push('#notes = :notes');
    }
    if (input.adjustmentSide !== undefined) {
      names['#adjustmentSide'] = 'adjustmentSide';
      values[':adjustmentSide'] = input.adjustmentSide;
      expressions.push('#adjustmentSide = :adjustmentSide');
    }
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildTransactionSortKey({ transactionId: input.transactionId }),
        },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  public async softDelete(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly transactionId: string;
    readonly deletedAtIso: string;
    readonly updatedAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildTransactionSortKey({ transactionId: input.transactionId }),
        },
        UpdateExpression: 'SET #isDeleted = :isDeleted, #deletedAt = :deletedAt, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#isDeleted': 'isDeleted',
          '#deletedAt': 'deletedAt',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':isDeleted': true,
          ':deletedAt': input.deletedAtIso,
          ':updatedAt': input.updatedAtIso,
        },
      }),
    );
  }
}

function parseTransactionRecord(input: { readonly item: Record<string, unknown> }): TransactionRecord | undefined {
  const transactionId: unknown = input.item['transactionId'];
  const portfolioId: unknown = input.item['portfolioId'];
  const assetId: unknown = input.item['assetId'];
  const transactionType: unknown = input.item['transactionType'];
  const tradeDate: unknown = input.item['tradeDate'];
  const tradeTimestamp: unknown = input.item['tradeTimestamp'];
  const quantity: unknown = input.item['quantity'];
  const unitPrice: unknown = input.item['unitPrice'];
  const grossAmount: unknown = input.item['grossAmount'];
  const feeAmount: unknown = input.item['feeAmount'];
  const currencyCode: unknown = input.item['currencyCode'];
  const notes: unknown = input.item['notes'];
  const adjustmentSide: unknown = input.item['adjustmentSide'];
  const isDeleted: unknown = input.item['isDeleted'];
  const deletedAt: unknown = input.item['deletedAt'];
  const createdAt: unknown = input.item['createdAt'];
  const updatedAt: unknown = input.item['updatedAt'];
  const createdByUserId: unknown = input.item['createdByUserId'];
  if (
    typeof transactionId !== 'string' ||
    typeof portfolioId !== 'string' ||
    typeof assetId !== 'string' ||
    typeof tradeDate !== 'string' ||
    typeof currencyCode !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    typeof createdByUserId !== 'string'
  ) {
    return undefined;
  }
  if (
    transactionType !== 'BUY' &&
    transactionType !== 'SELL' &&
    transactionType !== 'DIVIDEND' &&
    transactionType !== 'INTEREST' &&
    transactionType !== 'FEE' &&
    transactionType !== 'ADJUSTMENT'
  ) {
    return undefined;
  }
  const deleted: boolean = Boolean(isDeleted);
  return {
    transactionId,
    portfolioId,
    assetId,
    transactionType,
    tradeDate,
    tradeTimestampIso: typeof tradeTimestamp === 'string' ? tradeTimestamp : undefined,
    quantity: typeof quantity === 'string' ? quantity : undefined,
    unitPrice: typeof unitPrice === 'string' ? unitPrice : undefined,
    grossAmount: typeof grossAmount === 'string' ? grossAmount : undefined,
    feeAmount: typeof feeAmount === 'string' ? feeAmount : undefined,
    currencyCode,
    notes: typeof notes === 'string' ? notes : undefined,
    adjustmentSide: adjustmentSide === 'INCREASE' || adjustmentSide === 'DECREASE' ? adjustmentSide : undefined,
    isDeleted: deleted,
    deletedAtIso: typeof deletedAt === 'string' ? deletedAt : undefined,
    createdAtIso: createdAt,
    updatedAtIso: updatedAt,
    createdByUserId,
  };
}
