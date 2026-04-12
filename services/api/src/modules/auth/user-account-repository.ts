import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { buildUserAccountPartitionKey, getMetaSortKey, normalizeUsername } from './dynamo-auth-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

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
