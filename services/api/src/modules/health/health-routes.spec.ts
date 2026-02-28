import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/create-server.js';
import { prismaClient } from '../../db/prisma-client.js';

describe('healthRoutes', () => {
  beforeEach(() => {
    vi.spyOn(prismaClient, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health returns ok', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /ready returns ok when database query succeeds', async () => {
    vi.spyOn(prismaClient, '$queryRaw').mockResolvedValue([
      {
        now: new Date('2026-01-01T00:00:00.000Z'),
        server_version: 'postgres',
        current_database: 'badgers',
        current_user: 'badgers',
      },
    ] as unknown as []);
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /health/db returns ok and metadata when query succeeds', async () => {
    const now: Date = new Date('2026-01-01T00:00:00.000Z');
    vi.spyOn(prismaClient, '$queryRaw').mockResolvedValue([
      {
        now,
        server_version: 'postgres',
        current_database: 'badgers',
        current_user: 'badgers',
      },
    ] as unknown as []);
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health/db' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      database: {
        now: '2026-01-01T00:00:00.000Z',
        currentDatabase: 'badgers',
        currentUser: 'badgers',
        serverVersion: 'postgres',
      },
    });
    await app.close();
  });
});

