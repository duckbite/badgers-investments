import type { FastifyInstance } from 'fastify';
import { healthRoutes } from '../modules/health/health-routes.js';

export async function registerModules(input: { readonly app: FastifyInstance }): Promise<void> {
  await input.app.register(healthRoutes);
}

