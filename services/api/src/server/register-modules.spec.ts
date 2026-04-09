import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerModules } from './register-modules.js';

const hoisted = vi.hoisted(() => ({
  createDynamoDbClientMock: vi.fn(),
}));

vi.mock('../db/create-dynamo-db-client.js', () => ({
  createDynamoDbClient: hoisted.createDynamoDbClientMock,
}));

describe('registerModules', () => {
  beforeEach(() => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 't');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    hoisted.createDynamoDbClientMock.mockReturnValue({
      send: vi.fn().mockResolvedValue({}),
    });
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
});
