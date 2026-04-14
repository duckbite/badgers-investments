import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { buildUserPartitionKey, USER_SETTINGS_AI_SORT_KEY } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type UserAiSettingsRecord = {
  readonly userId: string;
  readonly aiProvider: string;
  readonly modelId: string;
  readonly apiKeyCipherTextBase64: string;
  readonly apiKeyIvBase64: string;
  readonly apiKeyAuthTagBase64: string;
  readonly updatedAtIso: string;
  readonly lastVerifyOk?: boolean;
  readonly lastVerifiedAtIso?: string;
};

export class UserAiSettingsRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async getByUserId(input: { readonly userId: string }): Promise<UserAiSettingsRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: USER_SETTINGS_AI_SORT_KEY,
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

  public async deleteByUserId(input: { readonly userId: string }): Promise<void> {
    await this.documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: USER_SETTINGS_AI_SORT_KEY,
        },
      }),
    );
  }

  public async put(input: { readonly record: UserAiSettingsRecord }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.record.userId }),
          [SORT_KEY]: USER_SETTINGS_AI_SORT_KEY,
          entityType: 'USER_AI_SETTINGS',
          userId: input.record.userId,
          aiProvider: input.record.aiProvider,
          modelId: input.record.modelId,
          apiKeyCipherTextBase64: input.record.apiKeyCipherTextBase64,
          apiKeyIvBase64: input.record.apiKeyIvBase64,
          apiKeyAuthTagBase64: input.record.apiKeyAuthTagBase64,
          updatedAtIso: input.record.updatedAtIso,
          ...(input.record.lastVerifyOk === undefined ? {} : { lastVerifyOk: input.record.lastVerifyOk }),
          ...(input.record.lastVerifiedAtIso === undefined ? {} : { lastVerifiedAtIso: input.record.lastVerifiedAtIso }),
        },
      }),
    );
  }
}

function parseRecord(input: { readonly item: Record<string, unknown> }): UserAiSettingsRecord | undefined {
  const userId: unknown = input.item['userId'];
  const aiProvider: unknown = input.item['aiProvider'];
  const modelId: unknown = input.item['modelId'];
  const apiKeyCipherTextBase64: unknown = input.item['apiKeyCipherTextBase64'];
  const apiKeyIvBase64: unknown = input.item['apiKeyIvBase64'];
  const apiKeyAuthTagBase64: unknown = input.item['apiKeyAuthTagBase64'];
  const updatedAtIso: unknown = input.item['updatedAtIso'];
  if (
    typeof userId !== 'string' ||
    typeof aiProvider !== 'string' ||
    typeof modelId !== 'string' ||
    typeof apiKeyCipherTextBase64 !== 'string' ||
    typeof apiKeyIvBase64 !== 'string' ||
    typeof apiKeyAuthTagBase64 !== 'string' ||
    typeof updatedAtIso !== 'string'
  ) {
    return undefined;
  }
  const lastVerifyOk: unknown = input.item['lastVerifyOk'];
  const lastVerifiedAtIso: unknown = input.item['lastVerifiedAtIso'];
  return {
    userId,
    aiProvider,
    modelId,
    apiKeyCipherTextBase64,
    apiKeyIvBase64,
    apiKeyAuthTagBase64,
    updatedAtIso,
    ...(typeof lastVerifyOk === 'boolean' ? { lastVerifyOk } : {}),
    ...(typeof lastVerifiedAtIso === 'string' ? { lastVerifiedAtIso } : {}),
  };
}
