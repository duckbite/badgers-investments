import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RecommendationRunService } from './recommendation-run-service.js';
export function registerRecommendationsRoutes(input: {
  readonly app: FastifyInstance;
  readonly recommendationRunService: RecommendationRunService;
}): void {
  input.app.post(
    '/recommendations/runs',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['deduped', 'run'],
            properties: {
              deduped: { type: 'boolean' },
              run: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'runId',
                  'portfolioId',
                  'runStatus',
                  'startedAt',
                  'completedAt',
                  'analyticsInputHash',
                  'synthesisSource',
                  'aiStatus',
                  'aiError',
                  'aiProvider',
                  'aiModel',
                  'portfolioLevelSummary',
                  'runItemCount',
                  'runActionableCount',
                  'runMaxStrengthScore',
                ],
                properties: {
                  runId: { type: 'string' },
                  portfolioId: { type: 'string' },
                  runStatus: { type: 'string' },
                  startedAt: { type: 'string' },
                  completedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  analyticsInputHash: { type: 'string' },
                  synthesisSource: { type: 'string', enum: ['AI', 'DETERMINISTIC'] },
                  aiStatus: { type: 'string', enum: ['OK', 'FAILED', 'SKIPPED'] },
                  aiError: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  aiProvider: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  aiModel: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  portfolioLevelSummary: { type: 'string' },
                  runItemCount: { type: 'number' },
                  runActionableCount: { type: 'number' },
                  runMaxStrengthScore: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                },
              },
            },
          },
          400: {
            type: 'object',
            additionalProperties: false,
            required: ['error'],
            properties: {
              error: {
                type: 'object',
                additionalProperties: false,
                required: ['code', 'message'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body = request.body as { readonly force?: boolean } | undefined;
      const force: boolean = body?.force === true;
      const result = await input.recommendationRunService.executeManualRun({ userId, now: new Date(), force });
      if (!result.ok) {
        return reply.code(400).send({ error: { code: result.error.code, message: result.error.message } });
      }
      return reply.send({ deduped: result.deduped, run: result.run });
    },
  );
  input.app.get(
    '/recommendations/runs',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const q = request.query as { readonly limit?: string };
      const limit: number = q.limit !== undefined ? Math.min(100, Math.max(1, Number.parseInt(q.limit, 10) || 30)) : 30;
      const items = await input.recommendationRunService.listRuns({ userId, now: new Date(), limit });
      return reply.send({ items });
    },
  );
  input.app.post(
    '/recommendations/runs/cancel-all-processing',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['cancelledCount'],
            properties: {
              cancelledCount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const result = await input.recommendationRunService.cancelAllRunningRuns({ userId, now: new Date() });
      return reply.send(result);
    },
  );
  input.app.post(
    '/recommendations/runs/:id/cancel',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['cancelled'],
            properties: {
              cancelled: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params = request.params as { readonly id: string };
      const result = await input.recommendationRunService.cancelRunById({
        userId,
        runId: params.id,
        now: new Date(),
      });
      return reply.send(result);
    },
  );
  input.app.delete(
    '/recommendations/runs/timeouts',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['deletedCount'],
            properties: {
              deletedCount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const result = await input.recommendationRunService.deleteTimedOutRuns({ userId, now: new Date() });
      return reply.send(result);
    },
  );
  input.app.delete(
    '/recommendations/runs/:id',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['deleted'],
            properties: {
              deleted: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params = request.params as { readonly id: string };
      const result = await input.recommendationRunService.deleteRunById({
        userId,
        runId: params.id,
        now: new Date(),
      });
      return reply.send(result);
    },
  );
  input.app.get(
    '/recommendations/runs/:id',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          404: {
            type: 'object',
            additionalProperties: false,
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params = request.params as { readonly id: string };
      const detail = await input.recommendationRunService.getRunDetail({ userId, now: new Date(), runId: params.id });
      if (detail === undefined) {
        return reply.code(404).send({ error: 'Run not found.' });
      }
      return reply.send(detail);
    },
  );
  input.app.get(
    '/recommendations/latest-summary',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['run'],
            properties: {
              run: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    additionalProperties: true,
                  },
                ],
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const items = await input.recommendationRunService.listRuns({ userId, now: new Date(), limit: 40 });
      const run = items.find((r) => r.runStatus === 'COMPLETED') ?? null;
      return reply.send({ run });
    },
  );
}
