import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildNotFoundErrorBody, buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { LedgerValidationError, type LedgerService, type TransactionDto, type TransactionPatchBody, type TransactionWriteBody } from './ledger-service.js';

const transactionTypeEnum = ['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'ADJUSTMENT'] as const;

const transactionDtoSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'transactionId',
    'portfolioId',
    'assetId',
    'transactionType',
    'tradeDate',
    'currencyCode',
    'isDeleted',
    'createdAt',
    'updatedAt',
    'createdByUserId',
  ],
  properties: {
    transactionId: { type: 'string' },
    portfolioId: { type: 'string' },
    assetId: { type: 'string' },
    transactionType: { type: 'string', enum: transactionTypeEnum as unknown as string[] },
    tradeDate: { type: 'string' },
    tradeTimestamp: { type: 'string' },
    quantity: { type: 'string' },
    unitPrice: { type: 'string' },
    grossAmount: { type: 'string' },
    feeAmount: { type: 'string' },
    currencyCode: { type: 'string' },
    notes: { type: 'string' },
    adjustmentSide: { type: 'string', enum: ['INCREASE', 'DECREASE'] },
    isDeleted: { type: 'boolean' },
    deletedAt: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    createdByUserId: { type: 'string' },
  },
} as const;

const createBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assetId', 'transactionType', 'tradeDate', 'currencyCode'],
  properties: {
    assetId: { type: 'string', minLength: 1 },
    transactionType: { type: 'string', enum: transactionTypeEnum as unknown as string[] },
    tradeDate: { type: 'string', minLength: 10, maxLength: 10 },
    tradeTimestamp: { type: 'string', minLength: 1 },
    quantity: { type: 'string', minLength: 1 },
    unitPrice: { type: 'string', minLength: 1 },
    grossAmount: { type: 'string', minLength: 1 },
    feeAmount: { type: 'string', minLength: 1 },
    currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    notes: { type: 'string', maxLength: 8000 },
    adjustmentSide: { type: 'string', enum: ['INCREASE', 'DECREASE'] },
  },
} as const;

const patchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assetId: { type: 'string', minLength: 1 },
    tradeDate: { type: 'string', minLength: 10, maxLength: 10 },
    tradeTimestamp: { type: 'string', minLength: 1 },
    quantity: { type: 'string', minLength: 1 },
    unitPrice: { type: 'string', minLength: 1 },
    grossAmount: { type: 'string', minLength: 1 },
    feeAmount: { type: 'string', minLength: 1 },
    currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    notes: { type: 'string', maxLength: 8000 },
    adjustmentSide: { type: 'string', enum: ['INCREASE', 'DECREASE'] },
  },
} as const;

const holdingsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['holdings', 'lotLinks'],
  properties: {
    holdings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['assetId', 'quantityHeld', 'costBasisRemaining', 'realisedPnlAmount', 'currencyCode'],
        properties: {
          assetId: { type: 'string' },
          quantityHeld: { type: 'string' },
          costBasisRemaining: { type: 'string' },
          realisedPnlAmount: { type: 'string' },
          currencyCode: { type: 'string' },
        },
      },
    },
    lotLinks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'linkId',
          'sellTransactionId',
          'buyTransactionId',
          'matchedQuantity',
          'buyUnitPrice',
          'sellUnitPrice',
          'realisedPnlAmount',
          'currencyCode',
          'createdAt',
        ],
        properties: {
          linkId: { type: 'string' },
          sellTransactionId: { type: 'string' },
          buyTransactionId: { type: 'string' },
          matchedQuantity: { type: 'string' },
          buyUnitPrice: { type: 'string' },
          sellUnitPrice: { type: 'string' },
          realisedPnlAmount: { type: 'string' },
          currencyCode: { type: 'string' },
          createdAt: { type: 'string' },
        },
      },
    },
  },
} as const;

export function registerLedgerRoutes(input: { readonly app: FastifyInstance; readonly ledgerService: LedgerService }): void {
  input.app.get(
    '/transactions',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            assetId: { type: 'string', minLength: 1 },
            includeDeleted: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: { type: 'array', items: transactionDtoSchema },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const query: { readonly assetId?: string; readonly includeDeleted?: 'true' | 'false' } = request.query as {
        readonly assetId?: string;
        readonly includeDeleted?: 'true' | 'false';
      };
      try {
        const items: readonly TransactionDto[] = await input.ledgerService.listTransactions({
          userId,
          assetId: query.assetId,
          includeDeleted: query.includeDeleted === 'true',
          now: new Date(),
        });
        return { items };
      } catch (err) {
        return handleLedgerError({ err, reply, request });
      }
    },
  );
  input.app.post(
    '/transactions',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: createBodySchema,
        response: {
          201: transactionDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const body: TransactionWriteBody = request.body as TransactionWriteBody;
      try {
        const created: TransactionDto = await input.ledgerService.createTransaction({ userId, body, now: new Date() });
        return reply.code(201).send(created);
      } catch (err) {
        return handleLedgerError({ err, reply, request });
      }
    },
  );
  input.app.patch(
    '/transactions/:transactionId',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['transactionId'],
          properties: { transactionId: { type: 'string', minLength: 1 } },
        },
        body: patchBodySchema,
        response: {
          200: transactionDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params: { readonly transactionId: string } = request.params as { readonly transactionId: string };
      const body: TransactionPatchBody = request.body as TransactionPatchBody;
      try {
        const updated: TransactionDto | undefined = await input.ledgerService.updateTransaction({
          userId,
          transactionId: params.transactionId,
          body,
          now: new Date(),
        });
        if (updated === undefined) {
          return reply.code(404).send(buildNotFoundErrorBody({ requestId: String(request.id), message: 'Transaction not found.' }));
        }
        return updated;
      } catch (err) {
        return handleLedgerError({ err, reply, request });
      }
    },
  );
  input.app.delete(
    '/transactions/:transactionId',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['transactionId'],
          properties: { transactionId: { type: 'string', minLength: 1 } },
        },
        response: {
          200: transactionDtoSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params: { readonly transactionId: string } = request.params as { readonly transactionId: string };
      try {
        const updated: TransactionDto | undefined = await input.ledgerService.softDeleteTransaction({
          userId,
          transactionId: params.transactionId,
          now: new Date(),
        });
        if (updated === undefined) {
          return reply.code(404).send(buildNotFoundErrorBody({ requestId: String(request.id), message: 'Transaction not found.' }));
        }
        return updated;
      } catch (err) {
        return handleLedgerError({ err, reply, request });
      }
    },
  );
  input.app.get(
    '/holdings',
    {
      preHandler: input.app.requireSession,
      schema: {
        response: {
          200: holdingsResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      try {
        const result = await input.ledgerService.getHoldings({ userId, now: new Date() });
        const lotLinks = result.lotLinks.map((row) => ({
          linkId: row.linkId,
          sellTransactionId: row.sellTransactionId,
          buyTransactionId: row.buyTransactionId,
          matchedQuantity: row.matchedQuantity,
          buyUnitPrice: row.buyUnitPrice,
          sellUnitPrice: row.sellUnitPrice,
          realisedPnlAmount: row.realisedPnlAmount,
          currencyCode: row.currencyCode,
          createdAt: row.createdAtIso,
        }));
        return { holdings: result.holdings, lotLinks };
      } catch (err) {
        return handleLedgerError({ err, reply, request });
      }
    },
  );
}

function handleLedgerError(input: { readonly err: unknown; readonly reply: FastifyReply; readonly request: FastifyRequest }) {
  if (input.err instanceof LedgerValidationError) {
    return input.reply
      .code(400)
      .send(buildValidationErrorBody({ requestId: String(input.request.id), code: input.err.code, message: input.err.message }));
  }
  throw input.err;
}
