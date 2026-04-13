import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioScopedPartitionKey, buildPositionSnapshotSortKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PositionSnapshotRecord = {
  readonly snapshotDate: string;
  readonly assetId: string;
  readonly quantityHeld: string;
  readonly costBasisAmount: string;
  readonly marketPrice: string | undefined;
  readonly marketPriceCurrencyCode: string | undefined;
  readonly marketValueAmount: string;
  readonly unrealisedPnlAmount: string;
  readonly realisedPnlCumulativeAmount: string;
  readonly allocationPct: string | undefined;
  readonly dataSourceSummaryJson: string;
  readonly createdAtIso: string;
};

export class PositionSnapshotRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async put(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly snapshotDate: string;
    readonly assetId: string;
    readonly quantityHeld: string;
    readonly costBasisAmount: string;
    readonly marketPrice: string | undefined;
    readonly marketPriceCurrencyCode: string | undefined;
    readonly marketValueAmount: string;
    readonly unrealisedPnlAmount: string;
    readonly realisedPnlCumulativeAmount: string;
    readonly allocationPct: string | undefined;
    readonly dataSourceSummaryJson: string;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPositionSnapshotSortKey({ snapshotDate: input.snapshotDate, assetId: input.assetId }),
          entityType: 'POSITION_SNAPSHOT',
          portfolioId: input.portfolioId,
          snapshotDate: input.snapshotDate,
          assetId: input.assetId,
          quantityHeld: input.quantityHeld,
          costBasisAmount: input.costBasisAmount,
          marketPrice: input.marketPrice,
          marketPriceCurrencyCode: input.marketPriceCurrencyCode,
          marketValueAmount: input.marketValueAmount,
          unrealisedPnlAmount: input.unrealisedPnlAmount,
          realisedPnlCumulativeAmount: input.realisedPnlCumulativeAmount,
          allocationPct: input.allocationPct,
          dataSourceSummaryJson: input.dataSourceSummaryJson,
          createdAt: input.createdAtIso,
        },
      }),
    );
  }

  public async listForSnapshotDate(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly snapshotDate: string;
  }): Promise<readonly PositionSnapshotRecord[]> {
    const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const skPrefix: string = `POS_SNAP#${input.snapshotDate}#`;
    const collected: PositionSnapshotRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':skPrefix': skPrefix,
          },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const row: PositionSnapshotRecord | undefined = parsePositionSnapshotRecord({ item });
        if (row !== undefined) {
          collected.push(row);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined);
    return collected.sort((left, right) => left.assetId.localeCompare(right.assetId));
  }
}

function parsePositionSnapshotRecord(input: { readonly item: Record<string, unknown> }): PositionSnapshotRecord | undefined {
  const snapshotDate: unknown = input.item['snapshotDate'];
  const assetId: unknown = input.item['assetId'];
  const quantityHeld: unknown = input.item['quantityHeld'];
  const costBasisAmount: unknown = input.item['costBasisAmount'];
  const marketPrice: unknown = input.item['marketPrice'];
  const marketPriceCurrencyCode: unknown = input.item['marketPriceCurrencyCode'];
  const marketValueAmount: unknown = input.item['marketValueAmount'];
  const unrealisedPnlAmount: unknown = input.item['unrealisedPnlAmount'];
  const realisedPnlCumulativeAmount: unknown = input.item['realisedPnlCumulativeAmount'];
  const allocationPct: unknown = input.item['allocationPct'];
  const dataSourceSummaryJson: unknown = input.item['dataSourceSummaryJson'];
  const createdAt: unknown = input.item['createdAt'];
  if (
    typeof snapshotDate !== 'string' ||
    typeof assetId !== 'string' ||
    typeof quantityHeld !== 'string' ||
    typeof costBasisAmount !== 'string' ||
    typeof marketValueAmount !== 'string' ||
    typeof unrealisedPnlAmount !== 'string' ||
    typeof realisedPnlCumulativeAmount !== 'string' ||
    typeof dataSourceSummaryJson !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return undefined;
  }
  if (marketPrice !== undefined && typeof marketPrice !== 'string') {
    return undefined;
  }
  if (marketPriceCurrencyCode !== undefined && typeof marketPriceCurrencyCode !== 'string') {
    return undefined;
  }
  if (allocationPct !== undefined && typeof allocationPct !== 'string') {
    return undefined;
  }
  const marketPriceStr: string | undefined = marketPrice === undefined ? undefined : marketPrice;
  const marketPriceCurrencyStr: string | undefined =
    marketPriceCurrencyCode === undefined ? undefined : marketPriceCurrencyCode;
  const allocationPctStr: string | undefined = allocationPct === undefined ? undefined : allocationPct;
  return {
    snapshotDate,
    assetId,
    quantityHeld,
    costBasisAmount,
    marketPrice: marketPriceStr,
    marketPriceCurrencyCode: marketPriceCurrencyStr,
    marketValueAmount,
    unrealisedPnlAmount,
    realisedPnlCumulativeAmount,
    allocationPct: allocationPctStr,
    dataSourceSummaryJson,
    createdAtIso: createdAt,
  };
}
