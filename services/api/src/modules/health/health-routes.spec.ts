import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/create-server.js';

const hoisted = vi.hoisted(() => ({
  createDynamoDbClientMock: vi.fn(),
}));

const dynamoDbSdkMock = mockClient(DynamoDBClient);

vi.mock('../../db/create-dynamo-db-client.js', () => ({
  createDynamoDbClient: hoisted.createDynamoDbClientMock,
}));

describe('healthRoutes', () => {
  beforeEach(() => {
    dynamoDbSdkMock.reset();
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-test');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    hoisted.createDynamoDbClientMock.mockReset();
    hoisted.createDynamoDbClientMock.mockImplementation(
      () => new DynamoDBClient({ region: 'eu-west-1' }),
    );
    dynamoDbSdkMock.on(DescribeTableCommand).resolves({
      Table: { TableName: 'badgers-test', TableStatus: 'ACTIVE' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('GET /health returns ok', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /ready returns ok when DynamoDB DescribeTable succeeds', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(hoisted.createDynamoDbClientMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    await app.close();
  });
});
