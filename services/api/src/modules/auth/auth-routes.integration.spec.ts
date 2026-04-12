import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  type GetCommandInput,
  type PutCommandInput,
} from '@aws-sdk/lib-dynamodb';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { registerModules } from '../../server/register-modules.js';
import { hashPassword } from './password-hash-service.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

const hoisted = vi.hoisted(() => ({
  createDynamoDbClientMock: vi.fn(),
}));

vi.mock('../../db/create-dynamo-db-client.js', () => ({
  createDynamoDbClient: hoisted.createDynamoDbClientMock,
}));

describe('auth routes (integration)', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'test-table');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    vi.stubEnv('NODE_ENV', 'development');
    hoisted.createDynamoDbClientMock.mockImplementation(
      () => new DynamoDBClient({ region: 'eu-west-1' }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs in, sets session cookie, and returns session for GET /auth/session', async () => {
    const passwordHash: string = hashPassword('secret');
    let sessionItem: Record<string, unknown> | undefined;
    ddbMock.on(GetCommand).callsFake((input: GetCommandInput) => {
      const key: Record<string, unknown> | undefined = input.Key as Record<string, unknown> | undefined;
      const pk: unknown = key?.['PK'];
      if (pk === 'USER_ACCOUNT#admin') {
        return Promise.resolve({
          Item: {
            userId: 'user-1',
            username: 'admin',
            passwordHash,
            isActive: true,
          },
        });
      }
      if (
        typeof pk === 'string' &&
        pk.startsWith('SESSION#') &&
        sessionItem !== undefined &&
        sessionItem['PK'] === pk
      ) {
        return Promise.resolve({ Item: sessionItem });
      }
      return Promise.resolve({});
    });
    ddbMock.on(PutCommand).callsFake((input: PutCommandInput) => {
      const item: Record<string, unknown> | undefined = input.Item as Record<string, unknown> | undefined;
      if (item !== undefined) {
        sessionItem = item;
      }
      return Promise.resolve({});
    });
    ddbMock.on(UpdateCommand).resolves({});
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'secret' },
    });
    expect(loginResponse.statusCode).toBe(200);
    const setCookieRaw: string | undefined = loginResponse.headers['set-cookie'];
    expect(setCookieRaw).toBeDefined();
    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { cookie: String(setCookieRaw) },
    });
    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json()).toEqual({
      authenticated: true,
      user: { userId: 'user-1', username: 'admin' },
    });
    await app.close();
  });

  it('returns generic 401 when password is wrong', async () => {
    const passwordHash: string = hashPassword('right');
    ddbMock.on(GetCommand).resolves({
      Item: {
        userId: 'user-1',
        username: 'admin',
        passwordHash,
        isActive: true,
      },
    });
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(loginResponse.statusCode).toBe(401);
    const body: { error: { code: string; message: string } } = loginResponse.json();
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(loginResponse.headers['set-cookie']).toBeUndefined();
    await app.close();
  });

  it('allows GET /portfolio when session cookie is valid', async () => {
    const passwordHash: string = hashPassword('secret');
    let sessionItem: Record<string, unknown> | undefined;
    ddbMock.on(GetCommand).callsFake((input: GetCommandInput) => {
      const key: Record<string, unknown> | undefined = input.Key as Record<string, unknown> | undefined;
      const pk: unknown = key?.['PK'];
      if (pk === 'USER_ACCOUNT#admin') {
        return Promise.resolve({
          Item: {
            userId: 'user-1',
            username: 'admin',
            passwordHash,
            isActive: true,
          },
        });
      }
      if (
        typeof pk === 'string' &&
        pk.startsWith('SESSION#') &&
        sessionItem !== undefined &&
        sessionItem['PK'] === pk
      ) {
        return Promise.resolve({ Item: sessionItem });
      }
      return Promise.resolve({});
    });
    ddbMock.on(PutCommand).callsFake((input: PutCommandInput) => {
      const item: Record<string, unknown> | undefined = input.Item as Record<string, unknown> | undefined;
      if (item !== undefined) {
        sessionItem = item;
      }
      return Promise.resolve({});
    });
    ddbMock.on(UpdateCommand).resolves({});
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'secret' },
    });
    const setCookieRaw: string | undefined = loginResponse.headers['set-cookie'];
    const portfolioResponse = await app.inject({
      method: 'GET',
      url: '/portfolio',
      headers: { cookie: String(setCookieRaw) },
    });
    expect(portfolioResponse.statusCode).toBe(200);
    expect(portfolioResponse.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('protects GET /portfolio without a session', async () => {
    ddbMock.on(GetCommand).resolves({});
    const app = Fastify({ logger: false });
    await registerModules({ app });
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/portfolio' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
