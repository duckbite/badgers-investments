import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastify from 'fastify';
import { AnalysisComputationError } from '../modules/analysis/analysis-computation-error.js';
import { AssetValidationError } from '../modules/assets/asset-service.js';
import { FifoValidationError } from '../modules/ledger/fifo-holdings-service.js';
import { LedgerValidationError } from '../modules/ledger/ledger-service.js';
import { buildApiPinoLoggerOptions } from '../config/build-api-pino-logger-options.js';
import { registerModules } from './register-modules.js';

function readIncomingIdHeader(req: IncomingMessage, lowerName: string): string | undefined {
  const headers: NodeJS.Dict<string | string[] | undefined> = req.headers;
  const value: string | string[] | undefined = headers[lowerName];
  if (typeof value === 'string') {
    const trimmed: string = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    const trimmed: string = value[0].trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function genReqId(req: IncomingMessage): string {
  return (
    readIncomingIdHeader(req, 'x-request-id') ??
    readIncomingIdHeader(req, 'x-correlation-id') ??
    randomUUID()
  );
}

export function buildDomainErrorHandler() {
  return async function domainErrorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const requestId: string = String(request.id);
    if (error instanceof AnalysisComputationError) {
      return reply.code(422).send({
        error: { code: error.code, message: error.message, requestId },
      });
    }
    if (
      error instanceof LedgerValidationError ||
      error instanceof FifoValidationError ||
      error instanceof AssetValidationError
    ) {
      return reply.code(400).send({
        error: { code: error.code, message: error.message, requestId },
      });
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', requestId },
    });
  };
}

export async function createServer(): Promise<FastifyInstance> {
  const app: FastifyInstance = fastify({
    logger: buildApiPinoLoggerOptions(),
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId,
  });
  app.setErrorHandler(buildDomainErrorHandler());
  await registerModules({ app });
  return app;
}
