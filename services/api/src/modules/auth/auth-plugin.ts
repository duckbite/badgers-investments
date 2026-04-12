import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getAuthConfig } from '../../config/get-auth-config.js';
import { getDynamoDbConfig } from '../../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../../db/create-dynamo-db-client.js';
import { AuthService } from './auth-service.js';
import { createRequireSessionPreHandler, registerAuthRoutes } from './register-auth-routes.js';
import { UserAccountRepository } from './user-account-repository.js';
import { UserSessionRepository } from './user-session-repository.js';

const authDomainPluginImpl: FastifyPluginAsync = async (app): Promise<void> => {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  const authConfig = getAuthConfig();
  const dynamoDbConfig = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const userAccountRepository = new UserAccountRepository({
    documentClient,
    tableName: dynamoDbConfig.tableName,
  });
  const userSessionRepository = new UserSessionRepository({
    documentClient,
    tableName: dynamoDbConfig.tableName,
  });
  const authService = new AuthService({
    userAccountRepository,
    userSessionRepository,
    authConfig,
  });
  registerAuthRoutes({ app, authService, authConfig });
  app.decorate('requireSession', createRequireSessionPreHandler({ authService, authConfig }));
};

export const authDomainPlugin = fp(authDomainPluginImpl, { name: 'auth-domain' });
