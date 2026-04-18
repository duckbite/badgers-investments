import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MARKET_PRICE_JOB_STATE_SORT_KEY, buildPortfolioScopedPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type MarketPriceJobStateRecord = {
  readonly lastRunStartedAtIso: string | undefined;
  readonly lastRunFinishedAtIso: string | undefined;
  readonly lastRunOk: boolean | undefined;
  readonly lastRunErrorMessage: string | undefined;
  readonly symbolsProcessed: number | undefined;
  readonly lastProviderKey: string | undefined;
};

export class MarketPriceJobStateRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async get(input: { readonly userId: string; readonly portfolioId: string }): Promise<MarketPriceJobStateRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: MARKET_PRICE_JOB_STATE_SORT_KEY,
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

  public async put(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly record: MarketPriceJobStateRecord;
    readonly updatedAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: MARKET_PRICE_JOB_STATE_SORT_KEY,
          entityType: 'MARKET_PRICE_JOB_STATE',
          portfolioId: input.portfolioId,
          lastRunStartedAt: input.record.lastRunStartedAtIso,
          lastRunFinishedAt: input.record.lastRunFinishedAtIso,
          lastRunOk: input.record.lastRunOk,
          lastRunErrorMessage: input.record.lastRunErrorMessage,
          symbolsProcessed: input.record.symbolsProcessed,
          lastProviderKey: input.record.lastProviderKey,
          updatedAt: input.updatedAtIso,
        },
      }),
    );
  }
}

function parseRecord(input: { readonly item: Record<string, unknown> }): MarketPriceJobStateRecord | undefined {
  const lastRunStartedAt: unknown = input.item['lastRunStartedAt'];
  const lastRunFinishedAt: unknown = input.item['lastRunFinishedAt'];
  const lastRunOk: unknown = input.item['lastRunOk'];
  const lastRunErrorMessage: unknown = input.item['lastRunErrorMessage'];
  const symbolsProcessed: unknown = input.item['symbolsProcessed'];
  const lastProviderKey: unknown = input.item['lastProviderKey'];
  return {
    lastRunStartedAtIso: typeof lastRunStartedAt === 'string' ? lastRunStartedAt : undefined,
    lastRunFinishedAtIso: typeof lastRunFinishedAt === 'string' ? lastRunFinishedAt : undefined,
    lastRunOk: typeof lastRunOk === 'boolean' ? lastRunOk : undefined,
    lastRunErrorMessage: typeof lastRunErrorMessage === 'string' ? lastRunErrorMessage : undefined,
    symbolsProcessed: typeof symbolsProcessed === 'number' ? symbolsProcessed : undefined,
    lastProviderKey: typeof lastProviderKey === 'string' ? lastProviderKey : undefined,
  };
}
