import type { FastifyInstance } from 'fastify';
import swaggerUi from '@fastify/swagger-ui';
import { isApiProductionEnvironment } from '../config/get-api-node-environment.js';

export async function registerOpenapiInteractiveDocumentation(input: { readonly app: FastifyInstance }): Promise<void> {
  if (isApiProductionEnvironment()) {
    return;
  }
  await input.app.register(swaggerUi, {
    routePrefix: '/api-docs',
  });
}
