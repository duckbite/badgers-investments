import type { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import { registerModules } from './register-modules.js';

export async function createServer(): Promise<FastifyInstance> {
  const app: FastifyInstance = fastify({
    logger: true,
  });
  await registerModules({ app });
  return app;
}
