import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { executeDailyMarketPriceJob } from '../../jobs/daily-market-prices.js';
import { PortfolioService } from '../portfolio/portfolio-service.js';
import type { MarketPriceJobStateRepository } from './market-price-job-state-repository.js';

const statusSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'lastRunStartedAt',
    'lastRunFinishedAt',
    'lastRunOk',
    'lastRunErrorMessage',
    'symbolsProcessed',
    'lastProviderKey',
  ],
  properties: {
    lastRunStartedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    lastRunFinishedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    lastRunOk: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    lastRunErrorMessage: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    symbolsProcessed: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    lastProviderKey: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

const runJobResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['usersProcessed', 'snapshotsWritten', 'errors', 'userIdsConfigured', 'userIdSource'],
  properties: {
    usersProcessed: { type: 'number' },
    snapshotsWritten: { type: 'number' },
    userIdsConfigured: { type: 'number' },
    userIdSource: { type: 'string', enum: ['env', 'scan'] },
    errors: { type: 'array', items: { type: 'string' } },
  },
} as const;

export function registerMarketPriceRoutes(input: {
  readonly app: FastifyInstance;
  readonly marketPriceJobStateRepository: MarketPriceJobStateRepository;
  readonly portfolioService: PortfolioService;
}): void {
  input.app.get(
    '/market-prices/status',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            anyOf: [statusSchema, { type: 'null' }],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const portfolioId: string = await input.portfolioService.requirePortfolioIdForUser({ userId, now: new Date() });
      const row = await input.marketPriceJobStateRepository.get({ userId, portfolioId });
      if (row === undefined) {
        return reply.send(null);
      }
      return reply.send({
        lastRunStartedAt: row.lastRunStartedAtIso ?? null,
        lastRunFinishedAt: row.lastRunFinishedAtIso ?? null,
        lastRunOk: row.lastRunOk ?? null,
        lastRunErrorMessage: row.lastRunErrorMessage ?? null,
        symbolsProcessed: row.symbolsProcessed ?? null,
        lastProviderKey: row.lastProviderKey ?? null,
      });
    },
  );

  input.app.post(
    '/market-prices/run',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: runJobResponseSchema,
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await executeDailyMarketPriceJob({ now: new Date() });
      return reply.send(result);
    },
  );
}
