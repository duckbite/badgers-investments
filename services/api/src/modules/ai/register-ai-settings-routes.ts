import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { AiSettingsService, AiSettingsServiceError } from './ai-settings-service.js';

const publicDtoSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'modelId', 'apiKeyMasked', 'hasStoredApiKey', 'lastVerifyOk', 'lastVerifiedAt', 'updatedAt'],
  properties: {
    provider: { type: 'string', enum: ['ANTHROPIC'] },
    modelId: { type: 'string' },
    apiKeyMasked: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    hasStoredApiKey: { type: 'boolean' },
    lastVerifyOk: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    lastVerifiedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    updatedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

const putBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    apiKey: { type: 'string', maxLength: 8192 },
  },
} as const;

const verifyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: {
    ok: { type: 'boolean' },
  },
} as const;

export function registerAiSettingsRoutes(input: { readonly app: FastifyInstance; readonly aiSettingsService: AiSettingsService }): void {
  input.app.get(
    '/settings/ai',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: publicDtoSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const userId: string = request.authUser?.userId ?? '';
      return await input.aiSettingsService.getForUser({ userId });
    },
  );
  input.app.put(
    '/settings/ai',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: putBodySchema,
        response: {
          200: publicDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body = request.body as { readonly apiKey?: string };
      try {
        return await input.aiSettingsService.putForUser({
          userId,
          body: {
            ...(body.apiKey === undefined ? {} : { apiKey: body.apiKey }),
          },
          now: new Date(),
        });
      } catch (err) {
        return handleAiSettingsError({ err, reply, request });
      }
    },
  );
  input.app.post(
    '/settings/ai/verify',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: verifyResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      try {
        return await input.aiSettingsService.verifyForUser({ userId, now: new Date() });
      } catch (err) {
        return handleAiSettingsError({ err, reply, request });
      }
    },
  );
}

function handleAiSettingsError(input: { readonly err: unknown; readonly reply: FastifyReply; readonly request: FastifyRequest }) {
  if (input.err instanceof AiSettingsServiceError) {
    return input.reply
      .code(400)
      .send(buildValidationErrorBody({ requestId: String(input.request.id), code: input.err.code, message: input.err.message }));
  }
  throw input.err;
}
