import type { FastifyInstance } from 'fastify';
import { authRoutes } from '../modules/auth/auth-routes.js';
import { assetsRoutes } from '../modules/assets/assets-routes.js';
import { aiRoutes } from '../modules/ai/ai-routes.js';
import { healthRoutes } from '../modules/health/health-routes.js';
import { jobsRoutes } from '../modules/jobs/jobs-routes.js';
import { ledgerRoutes } from '../modules/ledger/ledger-routes.js';
import { loggingModule } from '../modules/logging/logging-module.js';
import { performanceRoutes } from '../modules/performance/performance-routes.js';
import { portfolioRoutes } from '../modules/portfolio/portfolio-routes.js';
import { recommendationsRoutes } from '../modules/recommendations/recommendations-routes.js';
import { rulesRoutes } from '../modules/rules/rules-routes.js';
import { sessionsRoutes } from '../modules/sessions/sessions-routes.js';
import { snapshotsRoutes } from '../modules/snapshots/snapshots-routes.js';
import { valuationsRoutes } from '../modules/valuations/valuations-routes.js';

export async function registerModules(input: { readonly app: FastifyInstance }): Promise<void> {
  await input.app.register(loggingModule);
  await input.app.register(healthRoutes);
  await input.app.register(authRoutes);
  await input.app.register(sessionsRoutes);
  await input.app.register(portfolioRoutes);
  await input.app.register(assetsRoutes);
  await input.app.register(ledgerRoutes);
  await input.app.register(valuationsRoutes);
  await input.app.register(snapshotsRoutes);
  await input.app.register(performanceRoutes);
  await input.app.register(recommendationsRoutes);
  await input.app.register(rulesRoutes);
  await input.app.register(aiRoutes);
  await input.app.register(jobsRoutes);
}

