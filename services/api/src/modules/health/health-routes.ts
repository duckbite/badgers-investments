import type { FastifyPluginAsync } from 'fastify';
import { getDynamoDbConfig } from '../../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../../db/create-dynamo-db-client.js';
import { DynamoDbHealthService } from './dynamo-db-health-service.js';

type HealthResponseBody = {
  readonly status: 'ok';
};

type ReadyResponseBody = {
  readonly status: 'ok';
};

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string', enum: ['ok'] } },
} as const;

const readyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string', enum: ['ok'] } },
} as const;

export const healthRoutes: FastifyPluginAsync = async (app): Promise<void> => {
  const dynamoDbConfig = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig);
  const dynamoDbHealthService = new DynamoDbHealthService({
    dynamoDbClient,
    tableName: dynamoDbConfig.tableName,
  });
  app.get('/health', { schema: { response: { 200: healthResponseSchema } } }, async (): Promise<HealthResponseBody> => ({ status: 'ok' }));
  app.get('/ready', { schema: { response: { 200: readyResponseSchema } } }, async (): Promise<ReadyResponseBody> => {
    await dynamoDbHealthService.verifyTableAccessible();
    return { status: 'ok' };
  });
};
