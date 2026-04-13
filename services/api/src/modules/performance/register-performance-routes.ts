import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { PerformanceSnapshotRepository } from '../snapshots/performance-snapshot-repository.js';

export function registerPerformanceRoutes(input: {
  readonly app: FastifyInstance;
  readonly performanceSnapshotRepository: PerformanceSnapshotRepository;
  readonly portfolioService: PortfolioService;
}): void {
  input.app.get(
    '/performance/twr',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: 'string', minLength: 10, maxLength: 10 },
            to: { type: 'string', minLength: 10, maxLength: 10 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'periodDate',
                    'asOfTimestamp',
                    'subperiodReturn',
                    'cumulativeTwrReturn',
                    'valuationStartAmount',
                    'valuationEndAmount',
                    'externalCashFlowsAmount',
                    'calculationMethod',
                    'calculationVersion',
                    'createdAt',
                  ],
                  properties: {
                    periodDate: { type: 'string' },
                    asOfTimestamp: { type: 'string' },
                    subperiodReturn: { type: 'string' },
                    cumulativeTwrReturn: { type: 'string' },
                    valuationStartAmount: { type: 'string' },
                    valuationEndAmount: { type: 'string' },
                    externalCashFlowsAmount: { type: 'string' },
                    calculationMethod: { type: 'string' },
                    calculationVersion: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const portfolioId: string = await input.portfolioService.requirePortfolioIdForUser({ userId, now: new Date() });
      const query = request.query as { readonly from?: string; readonly to?: string };
      const all = await input.performanceSnapshotRepository.listAllAscending({ userId, portfolioId });
      const filtered =
        query.from === undefined && query.to === undefined
          ? all
          : all.filter((row) => {
              if (query.from !== undefined && row.periodDate < query.from) {
                return false;
              }
              if (query.to !== undefined && row.periodDate > query.to) {
                return false;
              }
              return true;
            });
      return reply.send({
        items: filtered.map((row) => ({
          periodDate: row.periodDate,
          asOfTimestamp: row.asOfTimestampIso,
          subperiodReturn: row.subperiodReturn,
          cumulativeTwrReturn: row.cumulativeTwrReturn,
          valuationStartAmount: row.valuationStartAmount,
          valuationEndAmount: row.valuationEndAmount,
          externalCashFlowsAmount: row.externalCashFlowsAmount,
          calculationMethod: row.calculationMethod,
          calculationVersion: row.calculationVersion,
          createdAt: row.createdAtIso,
        })),
      });
    },
  );
}
