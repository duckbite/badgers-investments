import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from './create-server.js';

const hoisted = vi.hoisted(() => ({
  createDynamoDbClientMock: vi.fn(),
}));

const dynamoDbSdkMock = mockClient(DynamoDBClient);

vi.mock('../db/create-dynamo-db-client.js', () => ({
  createDynamoDbClient: hoisted.createDynamoDbClientMock,
}));

describe('createServer', () => {
  beforeEach(() => {
    dynamoDbSdkMock.reset();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('API_NODE_ENV', '');
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'test-table');
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

  it('creates a server with health routes', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('serves OpenAPI JSON when not production', async () => {
    vi.stubEnv('API_NODE_ENV', 'development');
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api-docs/json' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch(/"openapi"\s*:\s*"3\./);
    await app.close();
  });

  it('does not expose OpenAPI when API_NODE_ENV is production', async () => {
    vi.stubEnv('API_NODE_ENV', 'production');
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api-docs/json' });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
