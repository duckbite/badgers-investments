import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildLotLinkSortKey, buildPortfolioScopedPartitionKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type LotLinkRecord = {
  readonly linkId: string;
  readonly sellTransactionId: string;
  readonly buyTransactionId: string;
  readonly matchedQuantity: string;
  readonly buyUnitPrice: string;
  readonly sellUnitPrice: string;
  readonly realisedPnlAmount: string;
  readonly currencyCode: string;
  readonly createdAtIso: string;
};

export class LotLinkRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async listByPortfolio(input: { readonly userId: string; readonly portfolioId: string }): Promise<readonly LotLinkRecord[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          ':skPrefix': 'LOTLINK#',
        },
        ConsistentRead: true,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    const parsed: LotLinkRecord[] = [];
    for (const item of items) {
      const record: LotLinkRecord | undefined = parseLotLinkRecord({ item });
      if (record !== undefined) {
        parsed.push(record);
      }
    }
    return parsed;
  }

  public async replaceAll(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly links: readonly LotLinkWrite[];
  }): Promise<void> {
    const existing: readonly LotLinkRecord[] = await this.listByPortfolio({
      userId: input.userId,
      portfolioId: input.portfolioId,
    });
    const deleteRequests: Array<{ DeleteRequest: { Key: Record<string, string> } }> = existing.map((row) => ({
      DeleteRequest: {
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildLotLinkSortKey({ sellTransactionId: row.sellTransactionId, linkId: row.linkId }),
        },
      },
    }));
    const putRequests: Array<{ PutRequest: { Item: Record<string, unknown> } }> = input.links.map((link) => ({
      PutRequest: {
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildLotLinkSortKey({ sellTransactionId: link.sellTransactionId, linkId: link.linkId }),
          entityType: 'LOTLINK',
          linkId: link.linkId,
          sellTransactionId: link.sellTransactionId,
          buyTransactionId: link.buyTransactionId,
          matchedQuantity: link.matchedQuantity,
          buyUnitPrice: link.buyUnitPrice,
          sellUnitPrice: link.sellUnitPrice,
          realisedPnlAmount: link.realisedPnlAmount,
          currencyCode: link.currencyCode,
          createdAt: link.createdAtIso,
        },
      },
    }));
    const chunks: Array<Array<{ DeleteRequest: { Key: Record<string, string> } } | { PutRequest: { Item: Record<string, unknown> } }>> =
      [];
    const allWrites: Array<{ DeleteRequest: { Key: Record<string, string> } } | { PutRequest: { Item: Record<string, unknown> } }> = [
      ...deleteRequests,
      ...putRequests,
    ];
    const batchSize: number = 25;
    for (let index = 0; index < allWrites.length; index += batchSize) {
      chunks.push(allWrites.slice(index, index + batchSize));
    }
    for (const chunk of chunks) {
      await this.documentClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk,
          },
        }),
      );
    }
  }
}

export type LotLinkWrite = {
  readonly linkId: string;
  readonly sellTransactionId: string;
  readonly buyTransactionId: string;
  readonly matchedQuantity: string;
  readonly buyUnitPrice: string;
  readonly sellUnitPrice: string;
  readonly realisedPnlAmount: string;
  readonly currencyCode: string;
  readonly createdAtIso: string;
};

function parseLotLinkRecord(input: { readonly item: Record<string, unknown> }): LotLinkRecord | undefined {
  const linkId: unknown = input.item['linkId'];
  const sellTransactionId: unknown = input.item['sellTransactionId'];
  const buyTransactionId: unknown = input.item['buyTransactionId'];
  const matchedQuantity: unknown = input.item['matchedQuantity'];
  const buyUnitPrice: unknown = input.item['buyUnitPrice'];
  const sellUnitPrice: unknown = input.item['sellUnitPrice'];
  const realisedPnlAmount: unknown = input.item['realisedPnlAmount'];
  const currencyCode: unknown = input.item['currencyCode'];
  const createdAt: unknown = input.item['createdAt'];
  if (
    typeof linkId !== 'string' ||
    typeof sellTransactionId !== 'string' ||
    typeof buyTransactionId !== 'string' ||
    typeof matchedQuantity !== 'string' ||
    typeof buyUnitPrice !== 'string' ||
    typeof sellUnitPrice !== 'string' ||
    typeof realisedPnlAmount !== 'string' ||
    typeof currencyCode !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return undefined;
  }
  return {
    linkId,
    sellTransactionId,
    buyTransactionId,
    matchedQuantity,
    buyUnitPrice,
    sellUnitPrice,
    realisedPnlAmount,
    currencyCode,
    createdAtIso: createdAt,
  };
}
