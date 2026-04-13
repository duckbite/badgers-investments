import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { buildPortfolioScopedPartitionKey, buildPositionSnapshotSortKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type PositionSnapshotRecord = {
  readonly snapshotDate: string;
  readonly assetId: string;
  readonly quantityHeld: string;
  readonly costBasisAmount: string;
  readonly marketPrice: string | undefined;
  readonly marketPriceCurrencyCode: string | undefined;
  readonly marketValueAmount: string;
  readonly unrealisedPnlAmount: string;
  readonly realisedPnlCumulativeAmount: string;
  readonly allocationPct: string | undefined;
  readonly dataSourceSummaryJson: string;
  readonly createdAtIso: string;
};

export class PositionSnapshotRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async put(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly snapshotDate: string;
    readonly assetId: string;
    readonly quantityHeld: string;
    readonly costBasisAmount: string;
    readonly marketPrice: string | undefined;
    readonly marketPriceCurrencyCode: string | undefined;
    readonly marketValueAmount: string;
    readonly unrealisedPnlAmount: string;
    readonly realisedPnlCumulativeAmount: string;
    readonly allocationPct: string | undefined;
    readonly dataSourceSummaryJson: string;
    readonly createdAtIso: string;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildPositionSnapshotSortKey({ snapshotDate: input.snapshotDate, assetId: input.assetId }),
          entityType: 'POSITION_SNAPSHOT',
          portfolioId: input.portfolioId,
          snapshotDate: input.snapshotDate,
          assetId: input.assetId,
          quantityHeld: input.quantityHeld,
          costBasisAmount: input.costBasisAmount,
          marketPrice: input.marketPrice,
          marketPriceCurrencyCode: input.marketPriceCurrencyCode,
          marketValueAmount: input.marketValueAmount,
          unrealisedPnlAmount: input.unrealisedPnlAmount,
          realisedPnlCumulativeAmount: input.realisedPnlCumulativeAmount,
          allocationPct: input.allocationPct,
          dataSourceSummaryJson: input.dataSourceSummaryJson,
          createdAt: input.createdAtIso,
        },
      }),
    );
  }
}
