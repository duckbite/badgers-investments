import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { isApiProductionEnvironment } from '../config/get-api-node-environment.js';
import { authDomainPlugin } from '../modules/auth/auth-plugin.js';
import { aiRoutes } from '../modules/ai/ai-routes.js';
import { domainDataPlugin } from '../modules/domain/domain-data-plugin.js';
import { healthRoutes } from '../modules/health/health-routes.js';
import { jobsRoutes } from '../modules/jobs/jobs-routes.js';
import { loggingModule } from '../modules/logging/logging-module.js';
import { registerOpenapiSchemaCollection } from './register-openapi-schema.js';
import { registerOpenapiInteractiveDocumentation } from './register-openapi-ui.js';
import { recommendationsRoutes } from '../modules/recommendations/recommendations-routes.js';
import { rulesRoutes } from '../modules/rules/rules-routes.js';
import { sessionsRoutes } from '../modules/sessions/sessions-routes.js';

function parseCorsOriginAllowlist(): readonly string[] {
  const raw: string | undefined = process.env.CORS_ORIGIN;
  if (raw === undefined) {
    return [];
  }
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export async function registerModules(input: { readonly app: FastifyInstance }): Promise<void> {
  const allowlist: readonly string[] = parseCorsOriginAllowlist();
  if (allowlist.length > 0) {
    await input.app.register(cors, {
      credentials: true,
      origin: [...allowlist],
    });
  } else if (!isApiProductionEnvironment()) {
    await input.app.register(cors, {
      origin: true,
      credentials: true,
    });
  }
  await input.app.register(loggingModule);
  await registerOpenapiSchemaCollection({ app: input.app });
  await input.app.register(healthRoutes);
  await input.app.register(authDomainPlugin);
  await input.app.register(sessionsRoutes);
  await input.app.register(domainDataPlugin);
  await input.app.register(recommendationsRoutes);
  await input.app.register(rulesRoutes);
  await input.app.register(aiRoutes);
  await input.app.register(jobsRoutes);
  await registerOpenapiInteractiveDocumentation({ app: input.app });
}

