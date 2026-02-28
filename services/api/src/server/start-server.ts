import type { FastifyInstance } from 'fastify';
import { getApiConfig } from '../config/get-api-config.js';

export async function startServer(input: { readonly app: FastifyInstance }): Promise<void> {
  const config = getApiConfig();
  await input.app.listen({ port: config.apiPort, host: '0.0.0.0' });
}

