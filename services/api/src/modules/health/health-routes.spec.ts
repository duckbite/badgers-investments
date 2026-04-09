import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/create-server.js';

const hoisted = vi.hoisted(() => ({
  createDynamoDbClientMock: vi.fn(),
}));

vi.mock('../../db/create-dynamo-db-client.js', () => ({
  createDynamoDbClient: hoisted.createDynamoDbClientMock,
}));

describe('healthRoutes', () => {
  beforeEach(() => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-test');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    hoisted.createDynamoDbClientMock.mockReset();
    hoisted.createDynamoDbClientMock.mockReturnValue({
      send: vi.fn().mockResolvedValue({ Table: { TableName: 'badgers-test' } }),
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
    expect(hoisted.createDynamoDbClientMock).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
