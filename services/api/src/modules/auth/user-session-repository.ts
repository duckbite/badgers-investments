import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { buildSessionPartitionKey, getMetaSortKey } from './dynamo-auth-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type UserSessionRecord = {
  readonly sessionId: string;
  readonly userId: string;
  readonly username: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly isRevoked: boolean;
};

export class UserSessionRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async createSession(input: {
    readonly sessionId: string;
    readonly userId: string;
    readonly username: string;
    readonly createdAtIso: string;
    readonly expiresAtIso: string;
    readonly ipAddress: string | undefined;
    readonly userAgent: string | undefined;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildSessionPartitionKey({ sessionId: input.sessionId }),
          [SORT_KEY]: getMetaSortKey(),
          entityType: 'USER_SESSION',
          sessionId: input.sessionId,
          userId: input.userId,
          username: input.username,
          createdAt: input.createdAtIso,
          lastSeenAt: input.createdAtIso,
          expiresAt: input.expiresAtIso,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          isRevoked: false,
        },
      }),
    );
  }

  public async findValidSession(input: { readonly sessionId: string; readonly now: Date }): Promise<UserSessionRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildSessionPartitionKey({ sessionId: input.sessionId }),
          [SORT_KEY]: getMetaSortKey(),
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    const isRevoked: unknown = item['isRevoked'];
    if (isRevoked === true) {
      return undefined;
    }
    const expiresAt: unknown = item['expiresAt'];
    if (typeof expiresAt !== 'string') {
      return undefined;
    }
    const expires: Date = new Date(expiresAt);
    if (expires.getTime() <= input.now.getTime()) {
      return undefined;
    }
    const sessionId: unknown = item['sessionId'];
    const userId: unknown = item['userId'];
    const username: unknown = item['username'];
    const createdAt: unknown = item['createdAt'];
    if (
      typeof sessionId !== 'string' ||
      typeof userId !== 'string' ||
      typeof username !== 'string' ||
      typeof createdAt !== 'string'
    ) {
      return undefined;
    }
    return { sessionId, userId, username, createdAt, expiresAt, isRevoked: false };
  }

  public async deleteSession(input: { readonly sessionId: string }): Promise<void> {
    await this.documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildSessionPartitionKey({ sessionId: input.sessionId }),
          [SORT_KEY]: getMetaSortKey(),
        },
      }),
    );
  }
}
