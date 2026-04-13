import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { FastifyInstance } from 'fastify';
import fastify from 'fastify';
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

export async function createServer(): Promise<FastifyInstance> {
  const app: FastifyInstance = fastify({
    logger: buildApiPinoLoggerOptions(),
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId,
  });
  await registerModules({ app });
  return app;
}
