import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { prismaClient } from '../db/prisma-client.js';
import { registerModules } from './register-modules.js';

export async function createServer(): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({ logger: true });
  app.addHook('onClose', async (): Promise<void> => {
    await prismaClient.$disconnect();
  });
  await registerModules({ app });
  return app;
}

