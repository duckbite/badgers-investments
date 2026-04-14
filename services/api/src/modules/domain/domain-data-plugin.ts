import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getDynamoDbConfig } from '../../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../../db/create-dynamo-db-client.js';
import { AssetRepository } from '../assets/asset-repository.js';
import { AssetService } from '../assets/asset-service.js';
import { registerAssetsRoutes } from '../assets/register-assets-routes.js';
import { FifoHoldingsService } from '../ledger/fifo-holdings-service.js';
import { LedgerService } from '../ledger/ledger-service.js';
import { LotLinkRepository } from '../ledger/lot-link-repository.js';
import { registerLedgerRoutes } from '../ledger/register-ledger-routes.js';
import { TransactionRepository } from '../ledger/transaction-repository.js';
import { registerPerformanceRoutes } from '../performance/register-performance-routes.js';
import { PortfolioConfigRepository } from '../portfolio/portfolio-config-repository.js';
import { PortfolioConfigService } from '../portfolio/portfolio-config-service.js';
import { PortfolioRepository } from '../portfolio/portfolio-repository.js';
import { PortfolioService } from '../portfolio/portfolio-service.js';
import { registerPortfolioConfigRoutes } from '../portfolio/register-portfolio-config-routes.js';
import { registerPortfolioDomainRoutes } from '../portfolio/register-portfolio-domain-routes.js';
import { PerformanceSnapshotRepository } from '../snapshots/performance-snapshot-repository.js';
import { PortfolioSnapshotRepository } from '../snapshots/portfolio-snapshot-repository.js';
import { PositionSnapshotRepository } from '../snapshots/position-snapshot-repository.js';
import { registerSnapshotsRoutes } from '../snapshots/register-snapshots-routes.js';
import { SnapshotInvalidationService } from '../snapshots/snapshot-invalidation-service.js';
import { SnapshotRebuildService } from '../snapshots/snapshot-rebuild-service.js';
import { SnapshotStateRepository } from '../snapshots/snapshot-state-repository.js';
import { PriceSnapshotRepository } from '../valuations/price-snapshot-repository.js';
import { PriceSnapshotService } from '../valuations/price-snapshot-service.js';
import { registerValuationsRoutes } from '../valuations/register-valuations-routes.js';
import { AiSettingsService } from '../ai/ai-settings-service.js';
import { registerAiSettingsRoutes } from '../ai/register-ai-settings-routes.js';
import { UserAiSettingsRepository } from '../ai/user-ai-settings-repository.js';
import { PrivacySettingsService } from '../privacy/privacy-settings-service.js';
import { registerPrivacySettingsRoutes } from '../privacy/register-privacy-settings-routes.js';
import { UserPrivacySettingsRepository } from '../privacy/user-privacy-settings-repository.js';

const domainDataPluginImpl: FastifyPluginAsync = async (app): Promise<void> => {
  const dynamoDbConfig = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const tableName: string = dynamoDbConfig.tableName;
  const portfolioRepository = new PortfolioRepository({ documentClient, tableName });
  const portfolioService = new PortfolioService({ portfolioRepository });
  const portfolioConfigRepository = new PortfolioConfigRepository({ documentClient, tableName });
  const portfolioConfigService = new PortfolioConfigService({ portfolioConfigRepository, portfolioService });
  const assetRepository = new AssetRepository({ documentClient, tableName });
  const assetService = new AssetService({ assetRepository, portfolioService });
  const transactionRepository = new TransactionRepository({ documentClient, tableName });
  const lotLinkRepository = new LotLinkRepository({ documentClient, tableName });
  const fifoHoldingsService = new FifoHoldingsService();
  const snapshotStateRepository = new SnapshotStateRepository({ documentClient, tableName });
  const snapshotInvalidationService = new SnapshotInvalidationService({ snapshotStateRepository });
  const ledgerService = new LedgerService({
    transactionRepository,
    lotLinkRepository,
    portfolioService,
    assetService,
    fifoHoldingsService,
    snapshotInvalidation: snapshotInvalidationService,
  });
  const priceSnapshotRepository = new PriceSnapshotRepository({ documentClient, tableName });
  const priceSnapshotService = new PriceSnapshotService({
    priceSnapshotRepository,
    assetService,
    portfolioService,
    snapshotInvalidation: snapshotInvalidationService,
  });
  const positionSnapshotRepository = new PositionSnapshotRepository({ documentClient, tableName });
  const portfolioSnapshotRepository = new PortfolioSnapshotRepository({ documentClient, tableName });
  const performanceSnapshotRepository = new PerformanceSnapshotRepository({ documentClient, tableName });
  const snapshotRebuildService = new SnapshotRebuildService({
    documentClient,
    tableName,
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
  registerPortfolioDomainRoutes({ app, portfolioService });
  registerPortfolioConfigRoutes({ app, portfolioConfigService });
  registerAssetsRoutes({ app, assetService });
  registerLedgerRoutes({ app, ledgerService });
  registerValuationsRoutes({ app, priceSnapshotService });
  registerSnapshotsRoutes({
    app,
    snapshotRebuildService,
    snapshotStateRepository,
    portfolioService,
    portfolioSnapshotRepository,
    positionSnapshotRepository,
  });
  registerPerformanceRoutes({ app, performanceSnapshotRepository, portfolioService });
  const userAiSettingsRepository = new UserAiSettingsRepository({ documentClient, tableName });
  const aiSettingsService = new AiSettingsService({ userAiSettingsRepository });
  registerAiSettingsRoutes({ app, aiSettingsService });
  const userPrivacySettingsRepository = new UserPrivacySettingsRepository({ documentClient, tableName });
  const privacySettingsService = new PrivacySettingsService({ userPrivacySettingsRepository });
  registerPrivacySettingsRoutes({ app, privacySettingsService });
};

export const domainDataPlugin = fp(domainDataPluginImpl, {
  name: 'domain-data',
  dependencies: ['auth-domain'],
});
