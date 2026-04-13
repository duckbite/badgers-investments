import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  PORTFOLIO_CONFIG_ACTIVE_SORT_KEY,
  buildPortfolioConfigVersionSortKey,
  buildPortfolioConfigVersionSortKeyPrefix,
  buildPortfolioScopedPartitionKey,
} from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PortfolioConfigVersionRecord = {
  readonly configVersionId: string;
  readonly portfolioId: string;
  readonly userId: string;
  readonly versionNumber: number;
  readonly riskProfileType: string;
  readonly riskScore: number | undefined;
  readonly baseCurrencyCode: string;
  readonly targetAllocationsJson: unknown;
  readonly concentrationLimitsJson: unknown;
  readonly preferencesJson?: unknown;
  readonly aiPromptOverridesJson?: unknown;
  readonly notes: string | undefined;
  readonly createdByUserId: string;
  readonly createdAtIso: string;
};

export type PortfolioConfigActivePointerRecord = {
  readonly activeConfigVersionId: string;
  readonly activeVersionNumber: number;
  readonly updatedAtIso: string;
};

export class PortfolioConfigRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async getActivePointer(input: {
    readonly userId: string;
    readonly portfolioId: string;
  }): Promise<PortfolioConfigActivePointerRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: PORTFOLIO_CONFIG_ACTIVE_SORT_KEY,
        },
        ConsistentRead: true,
      }),
    );
    return parseActivePointer({ item: response.Item });
  }

  public async getVersionByNumber(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly versionNumber: number;
  }): Promise<PortfolioConfigVersionRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPortfolioConfigVersionSortKey({ versionNumber: input.versionNumber }),
        },
        ConsistentRead: true,
      }),
    );
    return parseVersionRecord({ item: response.Item });
  }

  public async findVersionByConfigId(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly configVersionId: string;
  }): Promise<PortfolioConfigVersionRecord | undefined> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': buildPortfolioConfigVersionSortKeyPrefix(),
          ':id': input.configVersionId,
        },
        FilterExpression: 'configVersionId = :id',
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Items?.[0];
    if (item === undefined) {
      return undefined;
    }
    return parseVersionRecord({ item });
  }

  public async getLatestVersionNumber(input: { readonly userId: string; readonly portfolioId: string }): Promise<number> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': buildPortfolioConfigVersionSortKeyPrefix(),
        },
        ScanIndexForward: false,
        Limit: 1,
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Items?.[0];
    if (item === undefined) {
      return 0;
    }
    const versionNumber: unknown = item['versionNumber'];
    return typeof versionNumber === 'number' ? versionNumber : 0;
  }

  public async listVersions(input: { readonly userId: string; readonly portfolioId: string }): Promise<readonly PortfolioConfigVersionRecord[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': buildPortfolioConfigVersionSortKeyPrefix(),
        },
        ScanIndexForward: true,
        ConsistentRead: true,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    const parsed: PortfolioConfigVersionRecord[] = [];
    for (const item of items) {
      const record: PortfolioConfigVersionRecord | undefined = parseVersionRecord({ item });
      if (record !== undefined) {
        parsed.push(record);
      }
    }
    return parsed;
  }

  public async putVersion(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly versionNumber: number;
    readonly record: Omit<PortfolioConfigVersionRecord, 'versionNumber' | 'portfolioId' | 'userId'>;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPortfolioConfigVersionSortKey({ versionNumber: input.versionNumber }),
          entityType: 'PORTFOLIO_CONFIG_VERSION',
          configVersionId: input.record.configVersionId,
          portfolioId: input.portfolioId,
          userId: input.userId,
          versionNumber: input.versionNumber,
          riskProfileType: input.record.riskProfileType,
          ...(input.record.riskScore === undefined ? {} : { riskScore: input.record.riskScore }),
          baseCurrencyCode: input.record.baseCurrencyCode,
          targetAllocationsJson: input.record.targetAllocationsJson,
          concentrationLimitsJson: input.record.concentrationLimitsJson,
          ...(input.record.preferencesJson === undefined ? {} : { preferencesJson: input.record.preferencesJson }),
          ...(input.record.aiPromptOverridesJson === undefined ? {} : { aiPromptOverridesJson: input.record.aiPromptOverridesJson }),
          ...(input.record.notes === undefined ? {} : { notes: input.record.notes }),
          createdByUserId: input.record.createdByUserId,
          createdAt: input.record.createdAtIso,
        },
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  public async putActivePointer(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly pointer: PortfolioConfigActivePointerRecord;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: PORTFOLIO_CONFIG_ACTIVE_SORT_KEY,
          entityType: 'PORTFOLIO_CONFIG_ACTIVE',
          activeConfigVersionId: input.pointer.activeConfigVersionId,
          activeVersionNumber: input.pointer.activeVersionNumber,
          updatedAt: input.pointer.updatedAtIso,
        },
      }),
    );
  }
}

function parseActivePointer(input: { readonly item: Record<string, unknown> | undefined }): PortfolioConfigActivePointerRecord | undefined {
  if (input.item === undefined) {
    return undefined;
  }
  const activeConfigVersionId: unknown = input.item['activeConfigVersionId'];
  const activeVersionNumber: unknown = input.item['activeVersionNumber'];
  const updatedAt: unknown = input.item['updatedAt'];
  if (typeof activeConfigVersionId !== 'string' || typeof activeVersionNumber !== 'number' || typeof updatedAt !== 'string') {
    return undefined;
  }
  return { activeConfigVersionId, activeVersionNumber, updatedAtIso: updatedAt };
}

function parseVersionRecord(input: { readonly item: Record<string, unknown> | undefined }): PortfolioConfigVersionRecord | undefined {
  if (input.item === undefined) {
    return undefined;
  }
  const configVersionId: unknown = input.item['configVersionId'];
  const portfolioId: unknown = input.item['portfolioId'];
  const userId: unknown = input.item['userId'];
  const versionNumber: unknown = input.item['versionNumber'];
  const riskProfileType: unknown = input.item['riskProfileType'];
  const baseCurrencyCode: unknown = input.item['baseCurrencyCode'];
  const targetAllocationsJson: unknown = input.item['targetAllocationsJson'];
  const concentrationLimitsJson: unknown = input.item['concentrationLimitsJson'];
  const createdByUserId: unknown = input.item['createdByUserId'];
  const createdAt: unknown = input.item['createdAt'];
  if (
    typeof configVersionId !== 'string' ||
    typeof portfolioId !== 'string' ||
    typeof userId !== 'string' ||
    typeof versionNumber !== 'number' ||
    typeof riskProfileType !== 'string' ||
    typeof baseCurrencyCode !== 'string' ||
    typeof createdByUserId !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return undefined;
  }
  const riskScoreRaw: unknown = input.item['riskScore'];
  const riskScore: number | undefined = typeof riskScoreRaw === 'number' ? riskScoreRaw : undefined;
  const preferencesJson: unknown = input.item['preferencesJson'];
  const aiPromptOverridesJson: unknown = input.item['aiPromptOverridesJson'];
  const notesRaw: unknown = input.item['notes'];
  return {
    configVersionId,
    portfolioId,
    userId,
    versionNumber,
    riskProfileType,
    riskScore,
    baseCurrencyCode,
    targetAllocationsJson,
    concentrationLimitsJson,
    preferencesJson: preferencesJson === undefined ? undefined : preferencesJson,
    aiPromptOverridesJson: aiPromptOverridesJson === undefined ? undefined : aiPromptOverridesJson,
    notes: typeof notesRaw === 'string' ? notesRaw : undefined,
    createdByUserId,
    createdAtIso: createdAt,
  };
}
