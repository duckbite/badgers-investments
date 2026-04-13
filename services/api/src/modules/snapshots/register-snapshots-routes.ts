import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { PortfolioSnapshotRepository } from './portfolio-snapshot-repository.js';
import type { PositionSnapshotRepository } from './position-snapshot-repository.js';
import type { SnapshotRebuildService } from './snapshot-rebuild-service.js';
import type { SnapshotStateRepository } from './snapshot-state-repository.js';

const rebuildBodySchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    throughDate: { type: 'string', minLength: 10, maxLength: 10 },
  },
} as const;

const positionSnapshotItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'snapshotDate',
    'assetId',
    'quantityHeld',
    'costBasisAmount',
    'marketPrice',
    'marketPriceCurrencyCode',
    'marketValueAmount',
    'unrealisedPnlAmount',
    'realisedPnlCumulativeAmount',
    'allocationPct',
    'dataSourceSummaryJson',
    'createdAt',
  ],
  properties: {
    snapshotDate: { type: 'string' },
    assetId: { type: 'string' },
    quantityHeld: { type: 'string' },
    costBasisAmount: { type: 'string' },
    marketPrice: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    marketPriceCurrencyCode: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    marketValueAmount: { type: 'string' },
    unrealisedPnlAmount: { type: 'string' },
    realisedPnlCumulativeAmount: { type: 'string' },
    allocationPct: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    dataSourceSummaryJson: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

const portfolioSnapshotItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'snapshotDate',
    'totalMarketValueAmount',
    'totalUnrealisedPnlAmount',
    'totalRealisedPnlAmount',
    'allocationByAssetJson',
    'dataSourceSummaryJson',
    'createdAt',
  ],
  properties: {
    snapshotDate: { type: 'string' },
    totalMarketValueAmount: { type: 'string' },
    totalUnrealisedPnlAmount: { type: 'string' },
    totalRealisedPnlAmount: { type: 'string' },
    allocationByAssetJson: { type: 'string' },
    dataSourceSummaryJson: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

export function registerSnapshotsRoutes(input: {
  readonly app: FastifyInstance;
  readonly snapshotRebuildService: SnapshotRebuildService;
  readonly snapshotStateRepository: SnapshotStateRepository;
  readonly portfolioService: PortfolioService;
  readonly portfolioSnapshotRepository: PortfolioSnapshotRepository;
  readonly positionSnapshotRepository: PositionSnapshotRepository;
}): void {
  input.app.get(
    '/snapshots/latest',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['snapshotDate', 'portfolio', 'positions'],
            properties: {
              snapshotDate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              portfolio: { anyOf: [portfolioSnapshotItemSchema, { type: 'null' }] },
              positions: { type: 'array', items: positionSnapshotItemSchema },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const portfolioId: string = await input.portfolioService.requirePortfolioIdForUser({ userId, now: new Date() });
      const portfolio = await input.portfolioSnapshotRepository.getLatest({ userId, portfolioId });
      if (portfolio === undefined) {
        return reply.send({ snapshotDate: null, portfolio: null, positions: [] });
      }
      const positions = await input.positionSnapshotRepository.listForSnapshotDate({
        userId,
        portfolioId,
        snapshotDate: portfolio.snapshotDate,
      });
      return reply.send({
        snapshotDate: portfolio.snapshotDate,
        portfolio: {
          snapshotDate: portfolio.snapshotDate,
          totalMarketValueAmount: portfolio.totalMarketValueAmount,
          totalUnrealisedPnlAmount: portfolio.totalUnrealisedPnlAmount,
          totalRealisedPnlAmount: portfolio.totalRealisedPnlAmount,
          allocationByAssetJson: portfolio.allocationByAssetJson,
          dataSourceSummaryJson: portfolio.dataSourceSummaryJson,
          createdAt: portfolio.createdAtIso,
        },
        positions: positions.map((row) => ({
          snapshotDate: row.snapshotDate,
          assetId: row.assetId,
          quantityHeld: row.quantityHeld,
          costBasisAmount: row.costBasisAmount,
          marketPrice: row.marketPrice ?? null,
          marketPriceCurrencyCode: row.marketPriceCurrencyCode ?? null,
          marketValueAmount: row.marketValueAmount,
          unrealisedPnlAmount: row.unrealisedPnlAmount,
          realisedPnlCumulativeAmount: row.realisedPnlCumulativeAmount,
          allocationPct: row.allocationPct ?? null,
          dataSourceSummaryJson: row.dataSourceSummaryJson,
          createdAt: row.createdAtIso,
        })),
      });
    },
  );

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
