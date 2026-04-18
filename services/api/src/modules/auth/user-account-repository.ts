import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { buildUserAccountPartitionKey, getMetaSortKey, normalizeUsername } from './dynamo-auth-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';
const USER_ACCOUNT_PK_PREFIX: string = 'USER_ACCOUNT#';

export type UserAccountRecord = {
  readonly userId: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
};

export class UserAccountRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  /**
   * Scans the table for `USER_ACCOUNT` META rows (daily jobs, admin scripts).
   * Scan cost grows with table size; acceptable for small MVP tables.
   */
  public async listAllActiveUserIds(): Promise<readonly string[]> {
    const ids: string[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    const metaSk: string = getMetaSortKey();
    do {
      const response = await this.documentClient.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: exclusiveStartKey,
          FilterExpression:
            'begins_with(#pk, :pfx) AND #sk = :sk AND #etype = :etype AND (attribute_not_exists(#active) OR #active = :true)',
          ExpressionAttributeNames: {
            '#pk': PARTITION_KEY,
            '#sk': SORT_KEY,
            '#etype': 'entityType',
            '#active': 'isActive',
          },
          ExpressionAttributeValues: {
            ':pfx': USER_ACCOUNT_PK_PREFIX,
            ':sk': metaSk,
            ':etype': 'USER_ACCOUNT',
            ':true': true,
          },
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const userId: unknown = item['userId'];
        if (typeof userId === 'string' && userId.length > 0) {
          ids.push(userId);
        }
      }
      exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey !== undefined);
    return ids;
  }

  public async findByUsername(input: { readonly username: string }): Promise<UserAccountRecord | undefined> {
    const usernameNormalized: string = normalizeUsername({ rawUsername: input.username });
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserAccountPartitionKey({ usernameNormalized }),
          [SORT_KEY]: getMetaSortKey(),
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    const userId: unknown = item['userId'];
    const username: unknown = item['username'];
    const passwordHash: unknown = item['passwordHash'];
    const isActive: unknown = item['isActive'];
    if (typeof userId !== 'string' || typeof username !== 'string' || typeof passwordHash !== 'string') {
      return undefined;
    }
    const active: boolean = isActive === undefined ? true : Boolean(isActive);
    return { userId, username, passwordHash, isActive: active };
  }

  public async updatePasswordHash(input: { readonly username: string; readonly passwordHash: string; readonly updatedAtIso: string }): Promise<void> {
    const usernameNormalized: string = normalizeUsername({ rawUsername: input.username });
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserAccountPartitionKey({ usernameNormalized }),
          [SORT_KEY]: getMetaSortKey(),
        },
        UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':passwordHash': input.passwordHash,
          ':updatedAt': input.updatedAtIso,
        },
      }),
    );
  }

  public async touchLastLoginAt(input: { readonly username: string; readonly atIso: string }): Promise<void> {
    const usernameNormalized: string = normalizeUsername({ rawUsername: input.username });
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserAccountPartitionKey({ usernameNormalized }),
          [SORT_KEY]: getMetaSortKey(),
        },
        UpdateExpression: 'SET lastLoginAt = :lastLoginAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastLoginAt': input.atIso,
          ':updatedAt': input.atIso,
        },
      }),
    );
  }
}
