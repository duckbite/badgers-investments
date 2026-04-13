import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildPerformanceSnapshotSortKey, buildPortfolioScopedPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PerformanceSnapshotRecord = {
  readonly periodDate: string;
  readonly asOfTimestampIso: string;
  readonly subperiodReturn: string;
  readonly cumulativeTwrReturn: string;
  readonly valuationStartAmount: string;
  readonly valuationEndAmount: string;
  readonly externalCashFlowsAmount: string;
  readonly calculationMethod: string;
  readonly calculationVersion: string;
  readonly createdAtIso: string;
};

export class PerformanceSnapshotRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async put(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly periodDate: string;
    readonly asOfTimestampIso: string;
    readonly subperiodReturn: string;
    readonly cumulativeTwrReturn: string;
    readonly valuationStartAmount: string;
    readonly valuationEndAmount: string;
    readonly externalCashFlowsAmount: string;
    readonly calculationMethod: string;
    readonly calculationVersion: string;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPerformanceSnapshotSortKey({ periodDate: input.periodDate }),
          entityType: 'PERFORMANCE_SNAPSHOT',
          portfolioId: input.portfolioId,
          periodDate: input.periodDate,
          asOfTimestamp: input.asOfTimestampIso,
          subperiodReturn: input.subperiodReturn,
          cumulativeTwrReturn: input.cumulativeTwrReturn,
          valuationStartAmount: input.valuationStartAmount,
          valuationEndAmount: input.valuationEndAmount,
          externalCashFlowsAmount: input.externalCashFlowsAmount,
          calculationMethod: input.calculationMethod,
          calculationVersion: input.calculationVersion,
          createdAt: input.createdAtIso,
        },
      }),
    );
  }

  public async listInRange(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly fromDateInclusive: string;
    readonly toDateInclusive: string;
  }): Promise<readonly PerformanceSnapshotRecord[]> {
    const all: readonly PerformanceSnapshotRecord[] = await this.listAllAscending({
      userId: input.userId,
      portfolioId: input.portfolioId,
    });
    return all.filter((row) => row.periodDate >= input.fromDateInclusive && row.periodDate <= input.toDateInclusive);
  }

  public async listAllAscending(input: { readonly userId: string; readonly portfolioId: string }): Promise<readonly PerformanceSnapshotRecord[]> {
    const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const collected: PerformanceSnapshotRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':skPrefix': 'PERF_SNAP#',
          },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const row: PerformanceSnapshotRecord | undefined = parsePerformanceSnapshotRecord({ item });
        if (row !== undefined) {
          collected.push(row);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined);
    return collected.sort((left, right) => left.periodDate.localeCompare(right.periodDate));
  }
}

function parsePerformanceSnapshotRecord(input: { readonly item: Record<string, unknown> }): PerformanceSnapshotRecord | undefined {
  const periodDate: unknown = input.item['periodDate'];
  const asOfTimestamp: unknown = input.item['asOfTimestamp'];
  const subperiodReturn: unknown = input.item['subperiodReturn'];
  const cumulativeTwrReturn: unknown = input.item['cumulativeTwrReturn'];
  const valuationStartAmount: unknown = input.item['valuationStartAmount'];
  const valuationEndAmount: unknown = input.item['valuationEndAmount'];
  const externalCashFlowsAmount: unknown = input.item['externalCashFlowsAmount'];
  const calculationMethod: unknown = input.item['calculationMethod'];
  const calculationVersion: unknown = input.item['calculationVersion'];
  const createdAt: unknown = input.item['createdAt'];
  if (
    typeof periodDate !== 'string' ||
    typeof asOfTimestamp !== 'string' ||
    typeof subperiodReturn !== 'string' ||
    typeof cumulativeTwrReturn !== 'string' ||
    typeof valuationStartAmount !== 'string' ||
    typeof valuationEndAmount !== 'string' ||
    typeof externalCashFlowsAmount !== 'string' ||
    typeof calculationMethod !== 'string' ||
    typeof calculationVersion !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return undefined;
  }
  return {
    periodDate,
    asOfTimestampIso: asOfTimestamp,
    subperiodReturn,
    cumulativeTwrReturn,
    valuationStartAmount,
    valuationEndAmount,
    externalCashFlowsAmount,
    calculationMethod,
    calculationVersion,
    createdAtIso: createdAt,
  };
}
