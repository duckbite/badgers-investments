import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { buildAssetSortKey, buildPortfolioScopedPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type AssetType = 'STOCK' | 'ETF';

export type AssetRecord = {
  readonly assetId: string;
  readonly portfolioId: string;
  readonly assetType: AssetType;
  readonly name: string;
  readonly symbol: string;
  readonly currencyCode: string;
  readonly ownershipPct: string;
  readonly notes: string | undefined;
  readonly isin: string | undefined;
  readonly exchangeCode: string | undefined;
  readonly sector: string | undefined;
  /** When set, automatic market quotes are expected from this provider key; manual UI pricing is disabled. */
  readonly primaryPriceProviderKey: string | undefined;
  readonly isActive: boolean;
  readonly archivedAtIso: string | undefined;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export class AssetRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async listByPortfolio(input: { readonly userId: string; readonly portfolioId: string }): Promise<readonly AssetRecord[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': 'ASSET#',
        },
        ConsistentRead: true,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    const parsed: AssetRecord[] = [];
    for (const item of items) {
      const record: AssetRecord | undefined = parseAssetRecord({ item });
      if (record !== undefined) {
        parsed.push(record);
      }
    }
    return parsed;
  }

  public async getById(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly assetId: string;
  }): Promise<AssetRecord | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildAssetSortKey({ assetId: input.assetId }),
        },
        ConsistentRead: true,
      }),
    );
    const item: Record<string, unknown> | undefined = response.Item;
    if (item === undefined) {
      return undefined;
    }
    return parseAssetRecord({ item });
  }

  public async create(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly assetId: string;
    readonly assetType: AssetType;
    readonly name: string;
    readonly symbol: string;
    readonly currencyCode: string;
    readonly ownershipPct: string;
    readonly notes: string | undefined;
    readonly isin: string | undefined;
    readonly exchangeCode: string | undefined;
    readonly sector: string | undefined;
    readonly primaryPriceProviderKey: string | undefined;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildAssetSortKey({ assetId: input.assetId }),
          entityType: 'ASSET',
          assetId: input.assetId,
          portfolioId: input.portfolioId,
          assetType: input.assetType,
          name: input.name,
          symbol: input.symbol,
          currencyCode: input.currencyCode,
          ownershipPct: input.ownershipPct,
          notes: input.notes,
          isin: input.isin,
          exchangeCode: input.exchangeCode,
          sector: input.sector,
          primaryPriceProviderKey: input.primaryPriceProviderKey,
          isActive: true,
          archivedAt: undefined,
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
    readonly assetId: string;
    readonly name: string | undefined;
    readonly symbol: string | undefined;
    readonly ownershipPct: string | undefined;
    readonly notes: string | undefined;
    readonly isin: string | undefined;
    readonly exchangeCode: string | undefined;
    readonly sector: string | undefined;
    readonly primaryPriceProviderKey: string | null | undefined;
    readonly isActive: boolean | undefined;
    readonly archivedAtIso: string | undefined;
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
    if (input.symbol !== undefined) {
      names['#symbol'] = 'symbol';
      values[':symbol'] = input.symbol;
      expressions.push('#symbol = :symbol');
    }
    if (input.ownershipPct !== undefined) {
      names['#ownershipPct'] = 'ownershipPct';
      values[':ownershipPct'] = input.ownershipPct;
      expressions.push('#ownershipPct = :ownershipPct');
    }
    if (input.notes !== undefined) {
      names['#notes'] = 'notes';
      values[':notes'] = input.notes;
      expressions.push('#notes = :notes');
    }
    if (input.isin !== undefined) {
      names['#isin'] = 'isin';
      values[':isin'] = input.isin;
      expressions.push('#isin = :isin');
    }
    if (input.exchangeCode !== undefined) {
      names['#exchangeCode'] = 'exchangeCode';
      values[':exchangeCode'] = input.exchangeCode;
      expressions.push('#exchangeCode = :exchangeCode');
    }
    if (input.sector !== undefined) {
      names['#sector'] = 'sector';
      values[':sector'] = input.sector;
      expressions.push('#sector = :sector');
    }
    if (input.primaryPriceProviderKey !== undefined) {
      names['#primaryPriceProviderKey'] = 'primaryPriceProviderKey';
      values[':primaryPriceProviderKey'] = input.primaryPriceProviderKey;
      expressions.push('#primaryPriceProviderKey = :primaryPriceProviderKey');
    }
    if (input.isActive !== undefined) {
      names['#isActive'] = 'isActive';
      values[':isActive'] = input.isActive;
      expressions.push('#isActive = :isActive');
    }
    if (input.archivedAtIso !== undefined) {
      names['#archivedAt'] = 'archivedAt';
      values[':archivedAt'] = input.archivedAtIso;
      expressions.push('#archivedAt = :archivedAt');
    }
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildAssetSortKey({ assetId: input.assetId }),
        },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }
}

function parseAssetRecord(input: { readonly item: Record<string, unknown> }): AssetRecord | undefined {
  const assetId: unknown = input.item['assetId'];
  const portfolioId: unknown = input.item['portfolioId'];
  const assetType: unknown = input.item['assetType'];
  const name: unknown = input.item['name'];
  const symbol: unknown = input.item['symbol'];
  const currencyCode: unknown = input.item['currencyCode'];
  const ownershipPct: unknown = input.item['ownershipPct'];
  const notes: unknown = input.item['notes'];
  const isin: unknown = input.item['isin'];
  const exchangeCode: unknown = input.item['exchangeCode'];
  const sector: unknown = input.item['sector'];
  const primaryPriceProviderKey: unknown = input.item['primaryPriceProviderKey'];
  const isActive: unknown = input.item['isActive'];
  const archivedAt: unknown = input.item['archivedAt'];
  const createdAt: unknown = input.item['createdAt'];
  const updatedAt: unknown = input.item['updatedAt'];
  if (
    typeof assetId !== 'string' ||
    typeof portfolioId !== 'string' ||
    (assetType !== 'STOCK' && assetType !== 'ETF') ||
    typeof name !== 'string' ||
    typeof symbol !== 'string' ||
    typeof currencyCode !== 'string' ||
    typeof ownershipPct !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return undefined;
  }
  const active: boolean = isActive === undefined ? true : Boolean(isActive);
  return {
    assetId,
    portfolioId,
    assetType,
    name,
    symbol,
    currencyCode,
    ownershipPct,
    notes: typeof notes === 'string' ? notes : undefined,
    isin: typeof isin === 'string' ? isin : undefined,
    exchangeCode: typeof exchangeCode === 'string' ? exchangeCode : undefined,
    sector: typeof sector === 'string' ? sector : undefined,
    primaryPriceProviderKey: typeof primaryPriceProviderKey === 'string' ? primaryPriceProviderKey : undefined,
    isActive: active,
    archivedAtIso: typeof archivedAt === 'string' ? archivedAt : undefined,
    createdAtIso: createdAt,
    updatedAtIso: updatedAt,
  };
}
