import type { FastifyInstance } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { startServer } from './start-server.js';

describe('startServer', () => {
  it('listens on configured port', async () => {
    process.env['API_PORT'] = '3200';
    process.env['API_DATABASE_URL'] = 'postgresql://example';
    const listen = vi.fn(async () => undefined);
    const app = { listen } as unknown as FastifyInstance;
    await startServer({ app });
    expect(listen).toHaveBeenCalledWith({ port: 3200, host: '0.0.0.0' });
  });
});

