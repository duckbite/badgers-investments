import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AssetRepository } from '../assets/asset-repository.js';
import { FifoHoldingsService } from '../ledger/fifo-holdings-service.js';
import { TransactionRepository } from '../ledger/transaction-repository.js';
import { PortfolioConfigRepository } from '../portfolio/portfolio-config-repository.js';
import { PortfolioConfigService } from '../portfolio/portfolio-config-service.js';
import { PortfolioRepository } from '../portfolio/portfolio-repository.js';
import { PortfolioService } from '../portfolio/portfolio-service.js';
import { PerformanceSnapshotRepository } from '../snapshots/performance-snapshot-repository.js';
import { PortfolioSnapshotRepository } from '../snapshots/portfolio-snapshot-repository.js';
import { PositionSnapshotRepository } from '../snapshots/position-snapshot-repository.js';
import { SnapshotRebuildService } from '../snapshots/snapshot-rebuild-service.js';
import { SnapshotStateRepository } from '../snapshots/snapshot-state-repository.js';
import { UserAiSettingsRepository } from '../ai/user-ai-settings-repository.js';
import { PriceSnapshotRepository } from '../valuations/price-snapshot-repository.js';
import { RecommendationJobQueueRepository } from './recommendation-job-queue-repository.js';
import { RecommendationRunRepository } from './recommendation-run-repository.js';
import { RecommendationRunService } from './recommendation-run-service.js';

/**
 * Builds {@link RecommendationRunService} with the same Dynamo wiring as the API domain plugin.
 * Used by scripts and workers that process the recommendation queue outside Fastify.
 */
export function instantiateRecommendationRunService(input: {
  readonly documentClient: DynamoDBDocumentClient;
  readonly tableName: string;
}): RecommendationRunService {
  const portfolioRepository = new PortfolioRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const portfolioService = new PortfolioService({ portfolioRepository });
  const portfolioConfigRepository = new PortfolioConfigRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const portfolioConfigService = new PortfolioConfigService({ portfolioConfigRepository, portfolioService });
  const assetRepository = new AssetRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const transactionRepository = new TransactionRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const fifoHoldingsService = new FifoHoldingsService();
  const snapshotStateRepository = new SnapshotStateRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const priceSnapshotRepository = new PriceSnapshotRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const positionSnapshotRepository = new PositionSnapshotRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const portfolioSnapshotRepository = new PortfolioSnapshotRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const performanceSnapshotRepository = new PerformanceSnapshotRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const snapshotRebuildService = new SnapshotRebuildService({
    documentClient: input.documentClient,
    tableName: input.tableName,
    transactionRepository,
    fifoHoldingsService,
    priceSnapshotRepository,
    assetRepository,
    portfolioRepository,
    snapshotStateRepository,
    positionSnapshotRepository,
    portfolioSnapshotRepository,
    performanceSnapshotRepository,
    portfolioService,
  });
  const recommendationRunRepository = new RecommendationRunRepository({ documentClient: input.documentClient, tableName: input.tableName });
  const recommendationJobQueueRepository = new RecommendationJobQueueRepository({
    documentClient: input.documentClient,
    tableName: input.tableName,
  });
  const userAiSettingsRepository = new UserAiSettingsRepository({ documentClient: input.documentClient, tableName: input.tableName });
  return new RecommendationRunService({
    portfolioService,
    portfolioConfigService,
    assetRepository,
    transactionRepository,
    portfolioSnapshotRepository,
    positionSnapshotRepository,
    performanceSnapshotRepository,
    priceSnapshotRepository,
    snapshotRebuildService,
    recommendationRunRepository,
    recommendationJobQueueRepository,
    userAiSettingsRepository,
  });
}
