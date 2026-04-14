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
      const items = await input.recommendationRunService.listRuns({ userId, now: new Date(), limit: 1 });
      const run = items[0] ?? null;
      return reply.send({ run });
    },
  );
}
