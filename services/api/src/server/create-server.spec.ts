import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisComputationError } from '../modules/analysis/analysis-computation-error.js';
import { AssetValidationError } from '../modules/assets/asset-service.js';
import { FifoValidationError } from '../modules/ledger/fifo-holdings-service.js';
import { LedgerValidationError } from '../modules/ledger/ledger-service.js';
import { buildDomainErrorHandler, createServer } from './create-server.js';

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

  it('returns x-request-id on every response', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-request-id']).toBeDefined();
    expect(String(response.headers['x-request-id']).length).toBeGreaterThan(0);
    await app.close();
  });

  it('reuses incoming x-request-id when present', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'client-req-abc' },
    });
    expect(response.headers['x-request-id']).toBe('client-req-abc');
    await app.close();
  });

  it('falls back to x-correlation-id when x-request-id is absent', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-correlation-id': 'corr-xyz' },
    });
    expect(response.headers['x-request-id']).toBe('corr-xyz');
    await app.close();
  });

  describe('global error handler', () => {
    it('maps AnalysisComputationError to 422 with COMPUTATION_ERROR code', async () => {
      const app = fastify({ logger: false });
      app.setErrorHandler(buildDomainErrorHandler());
      app.get('/test-computation', async () => {
        throw new AnalysisComputationError('bad math');
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/test-computation' });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('COMPUTATION_ERROR');
      expect(body.error.message).toBe('bad math');
      await app.close();
    });

    it('maps LedgerValidationError to 400 with the error code', async () => {
      const app = fastify({ logger: false });
      app.setErrorHandler(buildDomainErrorHandler());
      app.get('/test-ledger', async () => {
        throw new LedgerValidationError({ code: 'LEDGER_TRADE_DATE_INVALID', message: 'bad date' });
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/test-ledger' });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('LEDGER_TRADE_DATE_INVALID');
      expect(body.error.message).toBe('bad date');
      await app.close();
    });

    it('maps AssetValidationError to 400', async () => {
      const app = fastify({ logger: false });
      app.setErrorHandler(buildDomainErrorHandler());
      app.get('/test-asset', async () => {
        throw new AssetValidationError({ code: 'ASSET_CURRENCY_INVALID', message: 'bad currency' });
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/test-asset' });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('ASSET_CURRENCY_INVALID');
      await app.close();
    });

    it('maps FifoValidationError to 400', async () => {
      const app = fastify({ logger: false });
      app.setErrorHandler(buildDomainErrorHandler());
      app.get('/test-fifo', async () => {
        throw new FifoValidationError({ code: 'LEDGER_INSUFFICIENT_LOTS', message: 'no lots' });
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/test-fifo' });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('LEDGER_INSUFFICIENT_LOTS');
      await app.close();
    });

    it('returns 500 with INTERNAL_ERROR for unknown errors', async () => {
      const app = fastify({ logger: false });
      app.setErrorHandler(buildDomainErrorHandler());
      app.get('/test-unknown', async () => {
        throw new Error('something exploded');
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/test-unknown' });
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INTERNAL_ERROR');
      await app.close();
    });
  });
});
