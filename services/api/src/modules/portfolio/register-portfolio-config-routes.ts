import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { PortfolioConfigValidationError, type PortfolioConfigService } from './portfolio-config-service.js';

const targetAllocationRowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assetClass', 'targetPct', 'minPct', 'maxPct'],
  properties: {
    assetClass: { type: 'string', minLength: 1, maxLength: 64 },
    targetPct: { type: 'string', minLength: 1, maxLength: 32 },
    minPct: { type: 'string', minLength: 1, maxLength: 32 },
    maxPct: { type: 'string', minLength: 1, maxLength: 32 },
  },
} as const;

const upsertBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'riskProfileType',
    'riskScore',
    'baseCurrencyCode',
    'targetAllocations',
    'concentrationLimits',
    'preferences',
    'aiPromptOverrides',
    'notes',
  ],
  properties: {
    riskProfileType: { type: 'string', minLength: 1, maxLength: 32 },
    riskScore: {
      anyOf: [{ type: 'integer', minimum: 1, maximum: 100 }, { type: 'null' }],
    },
    baseCurrencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    targetAllocations: {
      type: 'array',
      minItems: 1,
      items: targetAllocationRowSchema,
    },
    concentrationLimits: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    preferences: {},
    aiPromptOverrides: {},
    notes: { anyOf: [{ type: 'string', maxLength: 4000 }, { type: 'null' }] },
  },
} as const;

const portfolioConfigFullSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'configVersionId',
    'versionNumber',
    'isActive',
    'riskProfileType',
    'riskScore',
    'baseCurrencyCode',
    'targetAllocations',
    'concentrationLimits',
    'preferences',
    'aiPromptOverrides',
    'notes',
    'createdByUserId',
    'createdAt',
  ],
  properties: {
    configVersionId: { type: 'string' },
    versionNumber: { type: 'integer' },
    isActive: { type: 'boolean' },
    riskProfileType: { type: 'string' },
    riskScore: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    baseCurrencyCode: { type: 'string' },
    targetAllocations: {},
    concentrationLimits: {},
    preferences: {},
    aiPromptOverrides: {},
    notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    createdByUserId: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

const versionSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['configVersionId', 'versionNumber', 'isActive', 'createdAt'],
  properties: {
    configVersionId: { type: 'string' },
    versionNumber: { type: 'integer' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
  },
} as const;

export function registerPortfolioConfigRoutes(input: {
  readonly app: FastifyInstance;
  readonly portfolioConfigService: PortfolioConfigService;
}): void {
  input.app.get(
    '/portfolio/config',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: portfolioConfigFullSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      try {
        return await input.portfolioConfigService.getActiveForUser({ userId, now: new Date() });
      } catch (err) {
        return handleConfigError({ err, reply, request });
      }
    },
  );
  input.app.get(
    '/portfolio/config/versions',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: {
            type: 'array',
            items: versionSummarySchema,
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      try {
        return await input.portfolioConfigService.listVersionSummariesForUser({ userId, now: new Date() });
      } catch (err) {
        return handleConfigError({ err, reply, request });
      }
    },
  );
  input.app.put(
    '/portfolio/config',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: upsertBodySchema,
        response: {
          200: portfolioConfigFullSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body = request.body as {
        readonly riskProfileType: string;
        readonly riskScore: number | null;
        readonly baseCurrencyCode: string;
        readonly targetAllocations: readonly {
          readonly assetClass: string;
          readonly targetPct: string;
          readonly minPct: string;
          readonly maxPct: string;
        }[];
        readonly concentrationLimits: Readonly<Record<string, string>>;
        readonly preferences: unknown;
        readonly aiPromptOverrides: unknown;
        readonly notes: string | null;
      };
      try {
        return await input.portfolioConfigService.upsertNewVersionForUser({
          userId,
          body: {
            riskProfileType: body.riskProfileType,
            riskScore: body.riskScore,
            baseCurrencyCode: body.baseCurrencyCode,
            targetAllocations: body.targetAllocations,
            concentrationLimits: body.concentrationLimits,
            preferences: body.preferences,
            aiPromptOverrides: body.aiPromptOverrides,
            notes: body.notes,
          },
          now: new Date(),
        });
      } catch (err) {
        return handleConfigError({ err, reply, request });
      }
    },
  );
}

function handleConfigError(input: { readonly err: unknown; readonly reply: FastifyReply; readonly request: FastifyRequest }) {
  if (input.err instanceof PortfolioConfigValidationError) {
    return input.reply
      .code(400)
      .send(buildValidationErrorBody({ requestId: String(input.request.id), code: input.err.code, message: input.err.message }));
  }
  throw input.err;
}
