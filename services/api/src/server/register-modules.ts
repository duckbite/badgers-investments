import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authDomainPlugin } from '../modules/auth/auth-plugin.js';
import { aiRoutes } from '../modules/ai/ai-routes.js';
import { domainDataPlugin } from '../modules/domain/domain-data-plugin.js';
import { healthRoutes } from '../modules/health/health-routes.js';
import { jobsRoutes } from '../modules/jobs/jobs-routes.js';
import { loggingModule } from '../modules/logging/logging-module.js';
import { performanceRoutes } from '../modules/performance/performance-routes.js';
import { recommendationsRoutes } from '../modules/recommendations/recommendations-routes.js';
import { rulesRoutes } from '../modules/rules/rules-routes.js';
import { sessionsRoutes } from '../modules/sessions/sessions-routes.js';
import { snapshotsRoutes } from '../modules/snapshots/snapshots-routes.js';
import { valuationsRoutes } from '../modules/valuations/valuations-routes.js';

export async function registerModules(input: { readonly app: FastifyInstance }): Promise<void> {
  const corsOrigin: string | undefined = process.env.CORS_ORIGIN;
  if (corsOrigin !== undefined && corsOrigin.length > 0) {
    await input.app.register(cors, { origin: corsOrigin, credentials: true });
  }
  await input.app.register(loggingModule);
  await input.app.register(healthRoutes);
  await input.app.register(authDomainPlugin);
  await input.app.register(sessionsRoutes);
  await input.app.register(domainDataPlugin);
  await input.app.register(valuationsRoutes);
  await input.app.register(snapshotsRoutes);
  await input.app.register(performanceRoutes);
  await input.app.register(recommendationsRoutes);
  await input.app.register(rulesRoutes);
  await input.app.register(aiRoutes);
  await input.app.register(jobsRoutes);
}

