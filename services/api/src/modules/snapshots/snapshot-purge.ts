import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioScopedPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type SnapshotSkNamespace = 'POS_SNAP#' | 'PORT_SNAP#' | 'PERF_SNAP#';

export async function purgeSnapshotsFromDateOnward(input: {
  readonly documentClient: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly userId: string;
  readonly portfolioId: string;
  readonly fromDateInclusive: string;
  readonly skNamespace: SnapshotSkNamespace;
}): Promise<void> {
  const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
  const keys: { readonly PK: string; readonly SK: string }[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const response = await input.documentClient.send(
      new QueryCommand({
        TableName: input.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': input.skNamespace,
        },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: startKey,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    for (const item of items) {
      const rowPk: unknown = item[PARTITION_KEY];
      const rowSk: unknown = item[SORT_KEY];
      if (typeof rowPk !== 'string' || typeof rowSk !== 'string') {
        continue;
      }
      const snapshotDate: string | undefined = extractSnapshotDateFromSortKey({ sortKey: rowSk, namespace: input.skNamespace });
      if (snapshotDate === undefined) {
        continue;
      }
      if (snapshotDate >= input.fromDateInclusive) {
        keys.push({ PK: rowPk, SK: rowSk });
      }
    }
    startKey = response.LastEvaluatedKey;
  } while (startKey !== undefined);
  const chunkSize: number = 25;
  for (let i: number = 0; i < keys.length; i += chunkSize) {
    const chunk: readonly { readonly PK: string; readonly SK: string }[] = keys.slice(i, i + chunkSize);
    await input.documentClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [input.tableName]: chunk.map((key) => ({
            DeleteRequest: {
              Key: { [PARTITION_KEY]: key.PK, [SORT_KEY]: key.SK },
            },
          })),
        },
      }),
    );
  }
}

function extractSnapshotDateFromSortKey(input: { readonly sortKey: string; readonly namespace: SnapshotSkNamespace }): string | undefined {
  if (!input.sortKey.startsWith(input.namespace)) {
    return undefined;
  }
  const trimmed: string = input.sortKey.slice(input.namespace.length);
  const parts: string[] = trimmed.split('#');
  const date: string | undefined = parts[0];
  if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return undefined;
  }
  return date;
}
