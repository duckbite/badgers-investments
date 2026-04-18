import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { PriceSnapshotService, PriceSnapshotValidationError } from './price-snapshot-service.js';

const priceSnapshotDtoSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['priceSnapshotId', 'assetId', 'price', 'currencyCode', 'priceTimestamp', 'priceDate', 'createdAt'],
  properties: {
    priceSnapshotId: { type: 'string' },
    assetId: { type: 'string' },
    price: { type: 'string' },
    currencyCode: { type: 'string' },
    priceTimestamp: { type: 'string' },
    priceDate: { type: 'string' },
    providerKey: { type: 'string' },
    dataQuality: { type: 'string' },
    rawPayloadHash: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

const manualPriceBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assetId', 'price', 'currencyCode'],
  properties: {
    assetId: { type: 'string', minLength: 1 },
    price: { type: 'string', minLength: 1 },
    currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    priceTimestamp: { type: 'string', minLength: 1 },
    priceDate: { type: 'string', minLength: 10, maxLength: 10 },
  },
} as const;

export function registerValuationsRoutes(input: { readonly app: FastifyInstance; readonly priceSnapshotService: PriceSnapshotService }): void {
  input.app.post(
    '/prices/manual',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: manualPriceBodySchema,
        response: {
          201: priceSnapshotDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      try {
        const body = request.body as {
          readonly assetId: string;
          readonly price: string;
          readonly currencyCode: string;
          readonly priceTimestamp: string | undefined;
          readonly priceDate: string | undefined;
        };
        const created = await input.priceSnapshotService.createManual({
          userId,
          body,
          now: new Date(),
        });
        return reply.code(201).send(created);
      } catch (err) {
        if (err instanceof PriceSnapshotValidationError) {
          return reply
            .code(400)
            .send(buildValidationErrorBody({ requestId: String(request.id), code: err.code, message: err.message }));
        }
        throw err;
      }
    },
  );

  input.app.get(
    '/prices',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['assetId'],
          properties: {
            assetId: { type: 'string', minLength: 1 },
            limit: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: { type: 'array', items: priceSnapshotDtoSchema },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const query = request.query as { readonly assetId: string; readonly limit?: string };
      const limitParsed: number | undefined = query.limit === undefined ? undefined : Number.parseInt(query.limit, 10);
      const limit: number | undefined = limitParsed !== undefined && Number.isFinite(limitParsed) ? limitParsed : undefined;
      try {
        const items = await input.priceSnapshotService.listForAsset({
          userId,
          assetId: query.assetId,
          limit,
          now: new Date(),
        });
        return reply.send({ items });
      } catch (err) {
        if (err instanceof PriceSnapshotValidationError) {
          return reply
            .code(400)
            .send(buildValidationErrorBody({ requestId: String(request.id), code: err.code, message: err.message }));
        }
        throw err;
      }
    },
  );

  input.app.get(
    '/prices/latest',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['assetId'],
          properties: {
            assetId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            anyOf: [priceSnapshotDtoSchema, { type: 'null' }],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const query = request.query as { readonly assetId: string };
      try {
        const latest = await input.priceSnapshotService.getLatestForAsset({
          userId,
          assetId: query.assetId,
          now: new Date(),
        });
        return reply.send(latest ?? null);
      } catch (err) {
        if (err instanceof PriceSnapshotValidationError) {
          return reply
            .code(400)
            .send(buildValidationErrorBody({ requestId: String(request.id), code: err.code, message: err.message }));
        }
        throw err;
      }
    },
  );
}
