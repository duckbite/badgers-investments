import type { FastifyPluginAsync } from 'fastify';

/**
 * Portfolio API (MVP). `GET /portfolio` is a minimal authenticated placeholder until portfolio features land.
 */
export const portfolioRoutes: FastifyPluginAsync = async (app): Promise<void> => {
  app.get('/portfolio', { preHandler: app.requireSession }, async () => ({ status: 'ok' as const }));
};
