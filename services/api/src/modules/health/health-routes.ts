import type { FastifyPluginAsync } from 'fastify';
import { prismaClient } from '../../db/prisma-client.js';
import { DbHealthService } from './db-health-service.js';

type HealthResponseBody = {
  readonly status: 'ok';
};

type DatabaseHealthResponseBody = {
  readonly status: 'ok';
  readonly database: {
    readonly now: string;
    readonly currentDatabase: string;
    readonly currentUser: string;
    readonly serverVersion: string;
  };
};

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string', enum: ['ok'] } },
} as const;

const databaseHealthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'database'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    database: {
      type: 'object',
      additionalProperties: false,
      required: ['now', 'currentDatabase', 'currentUser', 'serverVersion'],
      properties: {
        now: { type: 'string' },
        currentDatabase: { type: 'string' },
        currentUser: { type: 'string' },
        serverVersion: { type: 'string' },
      },
    },
  },
} as const;

export const healthRoutes: FastifyPluginAsync = async (app): Promise<void> => {
  const dbHealthService: DbHealthService = new DbHealthService({ prismaClient });
  app.get('/health', { schema: { response: { 200: healthResponseSchema } } }, async (): Promise<HealthResponseBody> => ({ status: 'ok' }));
  app.get(
    '/health/db',
    { schema: { response: { 200: databaseHealthResponseSchema } } },
    async (): Promise<DatabaseHealthResponseBody> => {
      const meta = await dbHealthService.getDatabaseConnectionMetadata();
      return {
        status: 'ok',
        database: {
          now: meta.now.toISOString(),
          currentDatabase: meta.currentDatabase,
          currentUser: meta.currentUser,
          serverVersion: meta.serverVersion,
        },
      };
    },
  );
};

