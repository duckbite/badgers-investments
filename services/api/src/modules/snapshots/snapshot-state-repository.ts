import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNAPSHOT_STATE_SORT_KEY, buildPortfolioScopedPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type SnapshotStateRecord = {
  readonly earliestAffectedDate: string | undefined;
  readonly updatedAtIso: string;
};

export class SnapshotStateRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async get(input: { readonly userId: string; readonly portfolioId: string }): Promise<SnapshotStateRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: SNAPSHOT_STATE_SORT_KEY,
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    const earliest: unknown = item['earliestAffectedDate'];
    const updatedAt: unknown = item['updatedAt'];
    if (typeof updatedAt !== 'string') {
      return undefined;
    }
    return {
      earliestAffectedDate: typeof earliest === 'string' ? earliest : undefined,
      updatedAtIso: updatedAt,
    };
  }

  public async put(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly earliestAffectedDate: string | undefined;
    readonly updatedAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: SNAPSHOT_STATE_SORT_KEY,
          entityType: 'SNAPSHOT_STATE',
          earliestAffectedDate: input.earliestAffectedDate,
          updatedAt: input.updatedAtIso,
        },
      }),
    );
  }
}
