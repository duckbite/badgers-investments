import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioScopedPartitionKey, buildPriceSortKey, buildPriceSortKeyPrefixForAsset } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PriceSnapshotRecord = {
  readonly priceSnapshotId: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly price: string;
  readonly currencyCode: string;
  readonly priceTimestampIso: string;
  readonly priceDate: string;
  readonly providerKey: string | undefined;
  readonly createdAtIso: string;
};

export class PriceSnapshotRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async create(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly priceSnapshotId: string;
    readonly assetId: string;
    readonly price: string;
    readonly currencyCode: string;
    readonly priceTimestampIso: string;
    readonly priceDate: string;
    readonly providerKey: string | undefined;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPriceSortKey({
            assetId: input.assetId,
            priceTimestampIso: input.priceTimestampIso,
            priceSnapshotId: input.priceSnapshotId,
          }),
          entityType: 'PRICE_SNAPSHOT',
          priceSnapshotId: input.priceSnapshotId,
          portfolioId: input.portfolioId,
          assetId: input.assetId,
          price: input.price,
          currencyCode: input.currencyCode,
          priceTimestamp: input.priceTimestampIso,
          priceDate: input.priceDate,
          providerKey: input.providerKey,
          createdAt: input.createdAtIso,
        },
      }),
    );
  }

  public async listForAsset(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly assetId: string;
    readonly limit: number | undefined;
    readonly scanNewestFirst: boolean;
  }): Promise<readonly PriceSnapshotRecord[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': buildPriceSortKeyPrefixForAsset({ assetId: input.assetId }),
        },
        ScanIndexForward: !input.scanNewestFirst,
        Limit: input.limit,
        ConsistentRead: true,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    const parsed: PriceSnapshotRecord[] = [];
    for (const item of items) {
      const row: PriceSnapshotRecord | undefined = parsePriceSnapshotRecord({ item });
      if (row !== undefined) {
        parsed.push(row);
      }
    }
    return parsed;
  }

  public async findLatestForAssetOnOrBeforeDate(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly assetId: string;
    readonly onOrBeforeDate: string;
  }): Promise<PriceSnapshotRecord | undefined> {
    const rows: readonly PriceSnapshotRecord[] = await this.listForAsset({
      userId: input.userId,
      portfolioId: input.portfolioId,
      assetId: input.assetId,
      limit: undefined,
      scanNewestFirst: true,
    });
    for (const row of rows) {
      if (row.priceDate <= input.onOrBeforeDate) {
        return row;
      }
    }
    return undefined;
  }
}

function parsePriceSnapshotRecord(input: { readonly item: Record<string, unknown> }): PriceSnapshotRecord | undefined {
  const priceSnapshotId: unknown = input.item['priceSnapshotId'];
  const portfolioId: unknown = input.item['portfolioId'];
  const assetId: unknown = input.item['assetId'];
  const price: unknown = input.item['price'];
  const currencyCode: unknown = input.item['currencyCode'];
  const priceTimestamp: unknown = input.item['priceTimestamp'];
  const priceDate: unknown = input.item['priceDate'];
  const providerKey: unknown = input.item['providerKey'];
  const createdAt: unknown = input.item['createdAt'];
  if (
    typeof priceSnapshotId !== 'string' ||
    typeof portfolioId !== 'string' ||
    typeof assetId !== 'string' ||
    typeof price !== 'string' ||
    typeof currencyCode !== 'string' ||
    typeof priceTimestamp !== 'string' ||
    typeof priceDate !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return undefined;
  }
  return {
    priceSnapshotId,
    portfolioId,
    assetId,
    price,
    currencyCode,
    priceTimestampIso: priceTimestamp,
    priceDate,
    providerKey: typeof providerKey === 'string' ? providerKey : undefined,
    createdAtIso: createdAt,
  };
}
