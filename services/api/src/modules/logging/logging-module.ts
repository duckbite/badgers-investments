import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { isApiProductionEnvironment } from '../../config/get-api-node-environment.js';

function pathWithoutQuery(url: string): string {
  const queryIndex: number = url.indexOf('?');
  if (queryIndex === -1) {
    return url;
  }
  return url.slice(0, queryIndex);
}

function routeLabelForLog(request: FastifyRequest): string {
  const pattern: string | undefined = request.routeOptions.url;
  if (pattern !== undefined && pattern.length > 0) {
    return pattern;
  }
  return pathWithoutQuery(request.url);
}

const loggingModuleImpl: FastifyPluginAsync = async (app): Promise<void> => {
  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
    request.log.info({
      evt: 'http_request_start',
      method: request.method,
      path: pathWithoutQuery(request.url),
    });
  });
  app.addHook('onResponse', async (request, reply) => {
    const authUser = request.authUser;
    request.log.info({
      evt: 'http_request_complete',
      method: request.method,
      route: routeLabelForLog(request),
      path: pathWithoutQuery(request.url),
      statusCode: reply.statusCode,
      responseTimeMs: reply.elapsedTime,
      ...(authUser !== undefined ? { userId: authUser.userId } : {}),
    });
  });
  app.addHook('onError', async (request, reply, error) => {
    const isProd: boolean = isApiProductionEnvironment();
    request.log.error({
      evt: 'request_error',
      statusCode: reply.statusCode,
      err: {
        type: error.name,
        message: error.message,
        ...(isProd ? {} : { stack: error.stack }),
      },
    });
  });
};

export const loggingModule = fp(loggingModuleImpl, { name: 'structured-logging' });
