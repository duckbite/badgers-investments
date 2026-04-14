import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { PrivacySettingsService, PrivacySettingsServiceError } from './privacy-settings-service.js';

const publicDtoSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['hasAmountRevealPin'],
  properties: {
    hasAmountRevealPin: { type: 'boolean' },
  },
} as const;

const putPinBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pin'],
  properties: {
    pin: { type: 'string', minLength: 4, maxLength: 64 },
  },
} as const;

const verifyPinBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pin'],
  properties: {
    pin: { type: 'string', minLength: 1, maxLength: 64 },
  },
} as const;

const verifyPinResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: {
    ok: { type: 'boolean' },
  },
} as const;

export function registerPrivacySettingsRoutes(input: {
  readonly app: FastifyInstance;
  readonly privacySettingsService: PrivacySettingsService;
}): void {
  input.app.get(
    '/settings/privacy',
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
      return await input.privacySettingsService.getForUser({ userId });
    },
  );
  input.app.put(
    '/settings/privacy/amount-reveal-pin',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: putPinBodySchema,
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body = request.body as { readonly pin: string };
      try {
        await input.privacySettingsService.setAmountRevealPin({
          userId,
          pin: body.pin,
          now: new Date(),
        });
        return reply.code(204).send();
      } catch (err) {
        return handlePrivacyError({ err, reply, request });
      }
    },
  );
  input.app.post(
    '/settings/privacy/verify-amount-reveal-pin',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: verifyPinBodySchema,
        response: {
          200: verifyPinResponseSchema,
        },
      },
    },
       async (request: FastifyRequest) => {
      const userId: string = request.authUser?.userId ?? '';
      const body = request.body as { readonly pin: string };
      const ok: boolean = await input.privacySettingsService.verifyAmountRevealPin({
        userId,
        pin: body.pin,
      });
      return { ok };
    },
  );
}

function handlePrivacyError(input: { readonly err: unknown; readonly reply: FastifyReply; readonly request: FastifyRequest }) {
  if (input.err instanceof PrivacySettingsServiceError) {
    return input.reply
      .code(400)
      .send(buildValidationErrorBody({ requestId: String(input.request.id), code: input.err.code, message: input.err.message }));
  }
  throw input.err;
}
