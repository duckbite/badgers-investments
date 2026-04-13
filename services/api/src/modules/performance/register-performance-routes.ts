import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { PerformanceSnapshotRepository } from '../snapshots/performance-snapshot-repository.js';
import { utcCalendarDateYmd } from '../snapshots/snapshot-date-utils.js';
import { resolveTwrQueryBounds } from './resolve-twr-query-bounds.js';

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
            range: { type: 'string', enum: ['ALL', '1M', '3M', 'YTD', '1Y', 'all', '1m', '3m', 'ytd', '1y'] },
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
      const query = request.query as { readonly range?: string; readonly from?: string; readonly to?: string };
      const todayYmd: string = utcCalendarDateYmd({ instant: new Date() });
      const bounds = resolveTwrQueryBounds({
        range: query.range,
        from: query.from,
        to: query.to,
        todayYmd,
      });
      if (!bounds.ok) {
        return reply.code(400).send({ error: bounds.message });
      }
      const all = await input.performanceSnapshotRepository.listAllAscending({ userId, portfolioId });
      const filtered =
        bounds.fromInclusive === undefined && bounds.toInclusive === undefined
          ? all
          : all.filter((row) => {
              if (bounds.fromInclusive !== undefined && row.periodDate < bounds.fromInclusive) {
                return false;
              }
              if (bounds.toInclusive !== undefined && row.periodDate > bounds.toInclusive) {
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
