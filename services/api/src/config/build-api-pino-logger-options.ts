import type { FastifyServerOptions } from 'fastify';
import { getApiNodeEnvironment, isApiProductionEnvironment } from './get-api-node-environment.js';

function readOptionalTrimmedEnv(input: { readonly key: string }): string | undefined {
  const rawValue: string | undefined = process.env[input.key];
  if (rawValue === undefined) {
    return undefined;
  }
  const trimmedValue: string = rawValue.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

/**
 * Pino options for Fastify: JSON to stdout (CloudWatch-friendly in prod), redaction, service base fields.
 */
export function buildApiPinoLoggerOptions(): NonNullable<Exclude<FastifyServerOptions['logger'], boolean | undefined>> {
  const level: string =
    readOptionalTrimmedEnv({ key: 'API_LOG_LEVEL' }) ?? (isApiProductionEnvironment() ? 'info' : 'debug');
  return {
    level,
    messageKey: 'message',
    base: {
      service: 'badgers-api',
      environment: getApiNodeEnvironment(),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        '*.password',
        'password',
      ],
      censor: '[Redacted]',
    },
  };
}
