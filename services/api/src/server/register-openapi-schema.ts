import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import { isApiProductionEnvironment, isAwsLambdaExecutionEnvironment } from '../config/get-api-node-environment.js';

export async function registerOpenapiSchemaCollection(input: { readonly app: FastifyInstance }): Promise<void> {
  if (isApiProductionEnvironment() || isAwsLambdaExecutionEnvironment()) {
    return;
  }
  await input.app.register(swagger, {
    openapi: {
      info: {
        title: 'Badgers Investments API',
        description: 'REST API for Badgers Investments. OpenAPI is only served outside production.',
        version: '0.0.1',
      },
    },
  });
}
