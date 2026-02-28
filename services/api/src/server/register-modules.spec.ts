import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerModules } from './register-modules.js';

describe('registerModules', () => {
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

