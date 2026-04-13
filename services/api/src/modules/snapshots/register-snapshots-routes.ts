import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { SnapshotRebuildService } from './snapshot-rebuild-service.js';
import type { SnapshotStateRepository } from './snapshot-state-repository.js';

const rebuildBodySchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    throughDate: { type: 'string', minLength: 10, maxLength: 10 },
  },
} as const;

export function registerSnapshotsRoutes(input: {
  readonly app: FastifyInstance;
  readonly snapshotRebuildService: SnapshotRebuildService;
  readonly snapshotStateRepository: SnapshotStateRepository;
  readonly portfolioService: PortfolioService;
}): void {
  input.app.get(
    '/snapshots/status',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['earliestAffectedDate', 'updatedAt'],
            properties: {
              earliestAffectedDate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              updatedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const portfolioId: string = await input.portfolioService.requirePortfolioIdForUser({ userId, now: new Date() });
      const state = await input.snapshotStateRepository.get({ userId, portfolioId });
      return reply.send({
        earliestAffectedDate: state?.earliestAffectedDate ?? null,
        updatedAt: state?.updatedAtIso ?? null,
      });
    },
  );

  input.app.post(
    '/snapshots/rebuild',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: rebuildBodySchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['fromDate', 'throughDate', 'daysProcessed', 'earliestAffectedCleared'],
            properties: {
              fromDate: { type: 'string' },
              throughDate: { type: 'string' },
              daysProcessed: { type: 'number' },
              earliestAffectedCleared: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body = request.body as { readonly throughDate?: string } | null | undefined;
      const result = await input.snapshotRebuildService.rebuild({
        userId,
        now: new Date(),
        throughDate: body?.throughDate,
      });
      return reply.send(result);
    },
  );
}
