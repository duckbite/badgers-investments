import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildNotFoundErrorBody, buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { AssetValidationError, type AssetDto, type AssetListFilter, type AssetService } from './asset-service.js';

const assetDtoSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'assetId',
    'portfolioId',
    'assetType',
    'name',
    'symbol',
    'currencyCode',
    'ownershipPct',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    assetId: { type: 'string' },
    portfolioId: { type: 'string' },
    assetType: { type: 'string', enum: ['STOCK', 'ETF'] },
    name: { type: 'string' },
    symbol: { type: 'string' },
    currencyCode: { type: 'string' },
    ownershipPct: { type: 'string' },
    notes: { type: 'string' },
    isin: { type: 'string' },
    exchangeCode: { type: 'string' },
    sector: { type: 'string' },
    primaryPriceProviderKey: { type: 'string' },
    isActive: { type: 'boolean' },
    archivedAt: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const createBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assetType', 'name', 'symbol', 'currencyCode', 'ownershipPct'],
  properties: {
    assetType: { type: 'string', enum: ['STOCK', 'ETF'] },
    name: { type: 'string', minLength: 1, maxLength: 256 },
    symbol: { type: 'string', minLength: 1, maxLength: 32 },
    currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    ownershipPct: { type: 'string', minLength: 1, maxLength: 32 },
    notes: { type: 'string', maxLength: 4000 },
    isin: { type: 'string', maxLength: 32 },
    exchangeCode: { type: 'string', maxLength: 32 },
    sector: { type: 'string', maxLength: 128 },
    primaryPriceProviderKey: {
      anyOf: [{ type: 'string', enum: ['YAHOO_FINANCE', 'CRYPTO_AGGREGATE'] }, { type: 'null' }],
    },
  },
} as const;

const patchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 256 },
    symbol: { type: 'string', minLength: 1, maxLength: 32 },
    ownershipPct: { type: 'string', minLength: 1, maxLength: 32 },
    notes: { type: 'string', maxLength: 4000 },
    isin: { type: 'string', maxLength: 32 },
    exchangeCode: { type: 'string', maxLength: 32 },
    sector: { type: 'string', maxLength: 128 },
    primaryPriceProviderKey: {
      anyOf: [{ type: 'string', enum: ['YAHOO_FINANCE', 'CRYPTO_AGGREGATE'] }, { type: 'null' }],
    },
    archived: { type: 'boolean' },
  },
} as const;

export function registerAssetsRoutes(input: { readonly app: FastifyInstance; readonly assetService: AssetService }): void {
  input.app.get(
    '/assets',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            assetType: { type: 'string', enum: ['STOCK', 'ETF'] },
            active: { type: 'string', enum: ['active', 'archived', 'all'] },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: { type: 'array', items: assetDtoSchema },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const query: { readonly assetType?: 'STOCK' | 'ETF'; readonly active?: 'active' | 'archived' | 'all' } = request.query as {
        readonly assetType?: 'STOCK' | 'ETF';
        readonly active?: 'active' | 'archived' | 'all';
      };
      const filter: AssetListFilter = {
        assetType: query.assetType,
        active: query.active ?? 'all',
      };
      try {
        const items: readonly AssetDto[] = await input.assetService.list({ userId, filter, now: new Date() });
        return { items };
      } catch (err) {
        return handleAssetError({ err, reply, request });
      }
    },
  );
  input.app.post(
    '/assets',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: createBodySchema,
        response: {
          201: assetDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body: {
        readonly assetType: 'STOCK' | 'ETF';
        readonly name: string;
        readonly symbol: string;
        readonly currencyCode: string;
        readonly ownershipPct: string;
        readonly notes?: string;
        readonly isin?: string;
        readonly exchangeCode?: string;
        readonly sector?: string;
        readonly primaryPriceProviderKey?: 'YAHOO_FINANCE' | 'CRYPTO_AGGREGATE' | null;
      } = request.body as {
        readonly assetType: 'STOCK' | 'ETF';
        readonly name: string;
        readonly symbol: string;
        readonly currencyCode: string;
        readonly ownershipPct: string;
        readonly notes?: string;
        readonly isin?: string;
        readonly exchangeCode?: string;
        readonly sector?: string;
        readonly primaryPriceProviderKey?: 'YAHOO_FINANCE' | 'CRYPTO_AGGREGATE' | null;
      };
      try {
        const created: AssetDto = await input.assetService.create({
          userId,
          assetType: body.assetType,
          name: body.name,
          symbol: body.symbol,
          currencyCode: body.currencyCode,
          ownershipPct: body.ownershipPct,
          notes: body.notes,
          isin: body.isin,
          exchangeCode: body.exchangeCode,
          sector: body.sector,
          primaryPriceProviderKey: body.primaryPriceProviderKey,
          now: new Date(),
        });
        return reply.code(201).send(created);
      } catch (err) {
        return handleAssetError({ err, reply, request });
      }
    },
  );
  input.app.patch(
    '/assets/:assetId',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['assetId'],
          properties: { assetId: { type: 'string', minLength: 1 } },
        },
        body: patchBodySchema,
        response: {
          200: assetDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params: { readonly assetId: string } = request.params as { readonly assetId: string };
      const body: {
        readonly name?: string;
        readonly symbol?: string;
        readonly ownershipPct?: string;
        readonly notes?: string;
        readonly isin?: string;
        readonly exchangeCode?: string;
        readonly sector?: string;
        readonly primaryPriceProviderKey?: 'YAHOO_FINANCE' | 'CRYPTO_AGGREGATE' | null;
        readonly archived?: boolean;
      } = request.body as {
        readonly name?: string;
        readonly symbol?: string;
        readonly ownershipPct?: string;
        readonly notes?: string;
        readonly isin?: string;
        readonly exchangeCode?: string;
        readonly sector?: string;
        readonly primaryPriceProviderKey?: 'YAHOO_FINANCE' | 'CRYPTO_AGGREGATE' | null;
        readonly archived?: boolean;
      };
      try {
        const updated: AssetDto | undefined = await input.assetService.update({
          userId,
          assetId: params.assetId,
          name: body.name,
          symbol: body.symbol,
          ownershipPct: body.ownershipPct,
          notes: body.notes,
          isin: body.isin,
          exchangeCode: body.exchangeCode,
          sector: body.sector,
          primaryPriceProviderKey: body.primaryPriceProviderKey,
          archived: body.archived,
          now: new Date(),
        });
        if (updated === undefined) {
          return reply.code(404).send(buildNotFoundErrorBody({ requestId: String(request.id), message: 'Asset not found.' }));
        }
        return updated;
      } catch (err) {
        return handleAssetError({ err, reply, request });
      }
    },
  );
}

function handleAssetError(input: { readonly err: unknown; readonly reply: FastifyReply; readonly request: FastifyRequest }) {
  if (input.err instanceof AssetValidationError) {
    return input.reply
      .code(400)
      .send(buildValidationErrorBody({ requestId: String(input.request.id), code: input.err.code, message: input.err.message }));
  }
  throw input.err;
}
