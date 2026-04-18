import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getDynamoDbConfig } from '../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../db/create-dynamo-db-client.js';
import { UserAccountRepository } from '../modules/auth/user-account-repository.js';
import { AssetRepository } from '../modules/assets/asset-repository.js';
import { DailyMarketPriceJob } from '../modules/market-prices/daily-market-price-job.js';
import { getMarketPriceUserIdsFromEnv } from '../modules/market-prices/get-market-price-user-ids-from-env.js';
import { MarketPriceJobStateRepository } from '../modules/market-prices/market-price-job-state-repository.js';
import { PortfolioRepository } from '../modules/portfolio/portfolio-repository.js';
import { SnapshotInvalidationService } from '../modules/snapshots/snapshot-invalidation-service.js';
import { SnapshotStateRepository } from '../modules/snapshots/snapshot-state-repository.js';
import { PriceSnapshotRepository } from '../modules/valuations/price-snapshot-repository.js';

export type ExecuteDailyMarketPriceJobResult = {
  readonly usersProcessed: number;
  readonly snapshotsWritten: number;
  readonly errors: readonly string[];
  readonly userIdsConfigured: number;
  readonly userIdSource: 'env' | 'scan';
};

/**
 * Entry point for the daily worker and `pnpm daily:market-prices` (loads root `.env` via dotenv-cli).
 */
export async function executeDailyMarketPriceJob(input: { readonly now: Date }): Promise<ExecuteDailyMarketPriceJobResult> {
  const config = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(config);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const tableName: string = config.tableName;
  const fromEnv: readonly string[] = getMarketPriceUserIdsFromEnv();
  let userIds: readonly string[];
  let userIdSource: 'env' | 'scan';
  if (fromEnv.length > 0) {
    userIds = fromEnv;
    userIdSource = 'env';
  } else {
    const userAccountRepository = new UserAccountRepository({ documentClient, tableName });
    userIds = await userAccountRepository.listAllActiveUserIds();
    userIdSource = 'scan';
  }
  const uniqueUserIds: readonly string[] = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) {
    console.warn('No user accounts found for market price ingestion (scan returned empty and env override unset).');
    return { usersProcessed: 0, snapshotsWritten: 0, errors: [], userIdsConfigured: 0, userIdSource };
  }
  const assetRepository = new AssetRepository({ documentClient, tableName });
  const portfolioRepository = new PortfolioRepository({ documentClient, tableName });
  const priceSnapshotRepository = new PriceSnapshotRepository({ documentClient, tableName });
  const snapshotStateRepository = new SnapshotStateRepository({ documentClient, tableName });
  const snapshotInvalidation = new SnapshotInvalidationService({ snapshotStateRepository });
  const marketPriceJobStateRepository = new MarketPriceJobStateRepository({ documentClient, tableName });
  const job = new DailyMarketPriceJob({
    assetRepository,
    portfolioRepository,
    priceSnapshotRepository,
    snapshotInvalidation,
    marketPriceJobStateRepository,
  });
  const result = await job.runForUserIds({ userIds: uniqueUserIds, now: input.now });
  return { ...result, userIdsConfigured: uniqueUserIds.length, userIdSource };
}
