import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioScopedPartitionKey, buildPortfolioSnapshotSortKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PortfolioSnapshotRecord = {
  readonly snapshotDate: string;
  readonly totalMarketValueAmount: string;
  readonly totalUnrealisedPnlAmount: string;
  readonly totalRealisedPnlAmount: string;
  readonly allocationByAssetJson: string;
  readonly dataSourceSummaryJson: string;
  readonly createdAtIso: string;
};

export class PortfolioSnapshotRepository {
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
    readonly totalMarketValueAmount: string;
    readonly totalUnrealisedPnlAmount: string;
    readonly totalRealisedPnlAmount: string;
    readonly allocationByAssetJson: string;
    readonly dataSourceSummaryJson: string;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPortfolioSnapshotSortKey({ snapshotDate: input.snapshotDate }),
          entityType: 'PORTFOLIO_SNAPSHOT',
          portfolioId: input.portfolioId,
          snapshotDate: input.snapshotDate,
          totalMarketValueAmount: input.totalMarketValueAmount,
          totalUnrealisedPnlAmount: input.totalUnrealisedPnlAmount,
          totalRealisedPnlAmount: input.totalRealisedPnlAmount,
          allocationByAssetJson: input.allocationByAssetJson,
          dataSourceSummaryJson: input.dataSourceSummaryJson,
          createdAt: input.createdAtIso,
        },
      }),
    );
  }

  public async listAllAscending(input: { readonly userId: string; readonly portfolioId: string }): Promise<readonly PortfolioSnapshotRecord[]> {
    const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const collected: PortfolioSnapshotRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':skPrefix': 'PORT_SNAP#',
          },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const row: PortfolioSnapshotRecord | undefined = parsePortfolioSnapshotRecord({ item });
        if (row !== undefined) {
          collected.push(row);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined);
    return collected.sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));
  }
}

function parsePortfolioSnapshotRecord(input: { readonly item: Record<string, unknown> }): PortfolioSnapshotRecord | undefined {
  const snapshotDate: unknown = input.item['snapshotDate'];
  const totalMarketValueAmount: unknown = input.item['totalMarketValueAmount'];
  const totalUnrealisedPnlAmount: unknown = input.item['totalUnrealisedPnlAmount'];
  const totalRealisedPnlAmount: unknown = input.item['totalRealisedPnlAmount'];
  const allocationByAssetJson: unknown = input.item['allocationByAssetJson'];
  const dataSourceSummaryJson: unknown = input.item['dataSourceSummaryJson'];
  const createdAt: unknown = input.item['createdAt'];
  if (
    typeof snapshotDate !== 'string' ||
    typeof totalMarketValueAmount !== 'string' ||
    typeof totalUnrealisedPnlAmount !== 'string' ||
    typeof totalRealisedPnlAmount !== 'string' ||
    typeof allocationByAssetJson !== 'string' ||
    typeof dataSourceSummaryJson !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return undefined;
  }
  return {
    snapshotDate,
    totalMarketValueAmount,
    totalUnrealisedPnlAmount,
    totalRealisedPnlAmount,
    allocationByAssetJson,
    dataSourceSummaryJson,
    createdAtIso: createdAt,
  };
}
