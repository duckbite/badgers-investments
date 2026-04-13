import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import Fastify from 'fastify';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerModules } from './register-modules.js';

const hoisted = vi.hoisted(() => ({
  createDynamoDbClientMock: vi.fn(),
}));

const dynamoDbSdkMock = mockClient(DynamoDBClient);

vi.mock('../db/create-dynamo-db-client.js', () => ({
  createDynamoDbClient: hoisted.createDynamoDbClientMock,
}));

describe('registerModules', () => {
  beforeEach(() => {
    dynamoDbSdkMock.reset();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('API_NODE_ENV', '');
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 't');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    hoisted.createDynamoDbClientMock.mockImplementation(
      () => new DynamoDBClient({ region: 'eu-west-1' }),
    );
    dynamoDbSdkMock.on(DescribeTableCommand).resolves({ Table: { TableStatus: 'ACTIVE' } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('registers health routes', async () => {
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('registers CORS when CORS_ORIGIN is set', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    await app.close();
  });

  it('serves OpenAPI JSON at /api-docs/json when not production', async () => {
    vi.stubEnv('API_NODE_ENV', 'development');
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api-docs/json' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch(/"openapi"\s*:\s*"3\./);
    await app.close();
  });

  it('does not register OpenAPI routes in production (API_NODE_ENV)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('API_NODE_ENV', 'production');
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api-docs/json' });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
