import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { PortfolioValidationError, type PortfolioDto, type PortfolioService } from './portfolio-service.js';

const portfolioDtoSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['portfolioId', 'name', 'baseCurrencyCode', 'createdAt', 'updatedAt'],
  properties: {
    portfolioId: { type: 'string' },
    name: { type: 'string' },
    baseCurrencyCode: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const patchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 128 },
    baseCurrencyCode: { type: 'string', minLength: 3, maxLength: 3 },
  },
} as const;

export function registerPortfolioDomainRoutes(input: {
  readonly app: FastifyInstance;
  readonly portfolioService: PortfolioService;
}): void {
  input.app.get(
    '/portfolio',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: portfolioDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      try {
        const portfolio = await input.portfolioService.getOrCreateForUser({ userId, now: new Date() });
        return portfolio;
      } catch (err) {
        return handlePortfolioError({ err, reply, request });
      }
    },
  );
  input.app.patch(
    '/portfolio',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: patchBodySchema,
        response: {
          200: portfolioDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body: { readonly name?: string; readonly baseCurrencyCode?: string } = request.body as {
        readonly name?: string;
        readonly baseCurrencyCode?: string;
      };
      try {
        const updated: PortfolioDto | undefined = await input.portfolioService.updateForUser({
          userId,
          name: body.name,
          baseCurrencyCode: body.baseCurrencyCode,
          now: new Date(),
        });
        if (updated === undefined) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Portfolio not found.', requestId: String(request.id) } });
        }
        return updated;
      } catch (err) {
        return handlePortfolioError({ err, reply, request });
      }
    },
  );
}

function handlePortfolioError(input: { readonly err: unknown; readonly reply: FastifyReply; readonly request: FastifyRequest }) {
  if (input.err instanceof PortfolioValidationError) {
    return input.reply
      .code(400)
      .send(buildValidationErrorBody({ requestId: String(input.request.id), code: input.err.code, message: input.err.message }));
  }
  throw input.err;
}
