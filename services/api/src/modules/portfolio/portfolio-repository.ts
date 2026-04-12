import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioSortKey, buildUserPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PortfolioRecord = {
  readonly portfolioId: string;
  readonly userId: string;
  readonly name: string;
  readonly baseCurrencyCode: string;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export class PortfolioRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async findByUserId(input: { readonly userId: string }): Promise<PortfolioRecord | undefined> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildUserPartitionKey({ userId: input.userId }),
          ':skPrefix': 'PORTFOLIO#',
        },
        Limit: 1,
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Items?.[0];
    if (item === undefined) {
      return undefined;
    }
    return parsePortfolioRecord({ item });
  }

  public async getById(input: { readonly userId: string; readonly portfolioId: string }): Promise<PortfolioRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: buildPortfolioSortKey({ portfolioId: input.portfolioId }),
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    return parsePortfolioRecord({ item });
  }

  public async create(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly name: string;
    readonly baseCurrencyCode: string;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: buildPortfolioSortKey({ portfolioId: input.portfolioId }),
          entityType: 'PORTFOLIO',
          portfolioId: input.portfolioId,
          userId: input.userId,
          name: input.name,
          baseCurrencyCode: input.baseCurrencyCode,
          createdAt: input.createdAtIso,
          updatedAt: input.createdAtIso,
        },
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  public async update(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly name: string | undefined;
    readonly baseCurrencyCode: string | undefined;
    readonly updatedAtIso: string;
  }): Promise<void> {
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, unknown> = { ':updatedAt': input.updatedAtIso };
    const expressions: string[] = ['#updatedAt = :updatedAt'];
    if (input.name !== undefined) {
      names['#name'] = 'name';
      values[':name'] = input.name;
      expressions.push('#name = :name');
    }
    if (input.baseCurrencyCode !== undefined) {
      names['#baseCurrencyCode'] = 'baseCurrencyCode';
      values[':baseCurrencyCode'] = input.baseCurrencyCode;
      expressions.push('#baseCurrencyCode = :baseCurrencyCode');
    }
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildUserPartitionKey({ userId: input.userId }),
          [SORT_KEY]: buildPortfolioSortKey({ portfolioId: input.portfolioId }),
        },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }
}

function parsePortfolioRecord(input: { readonly item: Record<string, unknown> }): PortfolioRecord | undefined {
  const portfolioId: unknown = input.item['portfolioId'];
  const userId: unknown = input.item['userId'];
  const name: unknown = input.item['name'];
  const baseCurrencyCode: unknown = input.item['baseCurrencyCode'];
  const createdAt: unknown = input.item['createdAt'];
  const updatedAt: unknown = input.item['updatedAt'];
  if (
    typeof portfolioId !== 'string' ||
    typeof userId !== 'string' ||
    typeof name !== 'string' ||
    typeof baseCurrencyCode !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return undefined;
  }
  return {
    portfolioId,
    userId,
    name,
    baseCurrencyCode,
    createdAtIso: createdAt,
    updatedAtIso: updatedAt,
  };
}
