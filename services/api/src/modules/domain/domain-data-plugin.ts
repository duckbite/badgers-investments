import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getDynamoDbConfig } from '../../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../../db/create-dynamo-db-client.js';
import { AssetRepository } from '../assets/asset-repository.js';
import { AssetService } from '../assets/asset-service.js';
import { FifoHoldingsService } from '../ledger/fifo-holdings-service.js';
import { LedgerService } from '../ledger/ledger-service.js';
import { LotLinkRepository } from '../ledger/lot-link-repository.js';
import { TransactionRepository } from '../ledger/transaction-repository.js';
import { PortfolioRepository } from '../portfolio/portfolio-repository.js';
import { PortfolioService } from '../portfolio/portfolio-service.js';
import { registerAssetsRoutes } from '../assets/register-assets-routes.js';
import { registerLedgerRoutes } from '../ledger/register-ledger-routes.js';
import { registerPortfolioDomainRoutes } from '../portfolio/register-portfolio-domain-routes.js';

const domainDataPluginImpl: FastifyPluginAsync = async (app): Promise<void> => {
  const dynamoDbConfig = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const portfolioRepository = new PortfolioRepository({ documentClient, tableName: dynamoDbConfig.tableName });
  const portfolioService = new PortfolioService({ portfolioRepository });
  const assetRepository = new AssetRepository({ documentClient, tableName: dynamoDbConfig.tableName });
  const assetService = new AssetService({ assetRepository, portfolioService });
  const transactionRepository = new TransactionRepository({ documentClient, tableName: dynamoDbConfig.tableName });
  const lotLinkRepository = new LotLinkRepository({ documentClient, tableName: dynamoDbConfig.tableName });
  const fifoHoldingsService = new FifoHoldingsService();
  const ledgerService = new LedgerService({
    transactionRepository,
    lotLinkRepository,
    portfolioService,
    assetService,
    fifoHoldingsService,
  });
  registerPortfolioDomainRoutes({ app, portfolioService });
  registerAssetsRoutes({ app, assetService });
  registerLedgerRoutes({ app, ledgerService });
};

export const domainDataPlugin = fp(domainDataPluginImpl, {
  name: 'domain-data',
  dependencies: ['auth-domain'],
});
