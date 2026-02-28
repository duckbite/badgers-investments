import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaClient } from '../db/prisma-client.js';
import { createServer } from './create-server.js';

describe('createServer', () => {
  beforeEach(() => {
    vi.spyOn(prismaClient, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a server with health routes', async () => {
    const app = await createServer();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});

