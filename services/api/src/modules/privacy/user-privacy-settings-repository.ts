import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { buildUserPartitionKey, USER_SETTINGS_PRIVACY_SORT_KEY } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type UserPrivacySettingsRecord = {
  readonly userId: string;
  readonly amountRevealPinHash: string;
  readonly updatedAtIso: string;
};

export class UserPrivacySettingsRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async getByUserId(input: { readonly userId: string }): Promise<UserPrivacySettingsRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: USER_SETTINGS_PRIVACY_SORT_KEY,
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    return parseRecord({ item });
  }

  public async put(input: { readonly record: UserPrivacySettingsRecord }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.record.userId }),
          [SORT_KEY]: USER_SETTINGS_PRIVACY_SORT_KEY,
          entityType: 'USER_PRIVACY_SETTINGS',
          userId: input.record.userId,
          amountRevealPinHash: input.record.amountRevealPinHash,
          updatedAtIso: input.record.updatedAtIso,
        },
      }),
    );
  }

  public async deleteByUserId(input: { readonly userId: string }): Promise<void> {
    await this.documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: USER_SETTINGS_PRIVACY_SORT_KEY,
        },
      }),
    );
  }
}

function parseRecord(input: { readonly item: Record<string, unknown> }): UserPrivacySettingsRecord | undefined {
  const userId: unknown = input.item['userId'];
  const amountRevealPinHash: unknown = input.item['amountRevealPinHash'];
  const updatedAtIso: unknown = input.item['updatedAtIso'];
  if (typeof userId !== 'string' || typeof amountRevealPinHash !== 'string' || typeof updatedAtIso !== 'string') {
    return undefined;
  }
  return { userId, amountRevealPinHash, updatedAtIso };
}
