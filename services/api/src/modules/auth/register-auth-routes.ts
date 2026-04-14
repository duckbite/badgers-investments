import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { AuthConfig } from '../../config/get-auth-config.js';
import { buildValidationErrorBody } from '../domain/domain-error-bodies.js';
import { buildAuthRequiredErrorBody, buildInvalidCredentialsErrorBody } from './auth-error-bodies.js';
import type { AuthService } from './auth-service.js';

const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 128 },
    password: { type: 'string', minLength: 1, maxLength: 1024 },
  },
} as const;

const sessionUserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['userId', 'username'],
  properties: {
    userId: { type: 'string' },
    username: { type: 'string' },
  },
} as const;

const loginOkSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['user'],
  properties: {
    user: sessionUserSchema,
  },
} as const;

const sessionOkSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['authenticated', 'user'],
  properties: {
    authenticated: { type: 'boolean', enum: [true] },
    user: sessionUserSchema,
  },
} as const;

const sessionAnonymousSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['authenticated'],
  properties: {
    authenticated: { type: 'boolean', enum: [false] },
  },
} as const;

const changePasswordBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['currentPassword', 'newPassword'],
  properties: {
    currentPassword: { type: 'string', minLength: 1, maxLength: 1024 },
    newPassword: { type: 'string', minLength: 8, maxLength: 1024 },
  },
} as const;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: true,
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
} as const;

/**
 * Registers `POST /auth/login`, `POST /auth/logout`, `POST /auth/change-password`, and `GET /auth/session`.
 */
export function registerAuthRoutes(input: {
  readonly app: FastifyInstance;
  readonly authService: AuthService;
  readonly authConfig: AuthConfig;
}): void {
  input.app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: input.authConfig.loginRateLimitMax,
          timeWindow: input.authConfig.loginRateLimitWindowMilliseconds,
        },
      },
      schema: {
        body: loginBodySchema,
        response: {
          200: loginOkSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body: { readonly username: string; readonly password: string } = request.body as {
        readonly username: string;
        readonly password: string;
      };
      const result = await input.authService.login({
        username: body.username,
        password: body.password,
        now: new Date(),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      if (result.outcome === 'invalid_credentials') {
        return reply
          .code(401)
          .send(buildInvalidCredentialsErrorBody({ requestId: String(request.id) }));
      }
      reply.setCookie(input.authConfig.sessionCookieName, result.sessionId, {
        path: '/',
        httpOnly: true,
        secure: input.authConfig.isCookieSecure,
        sameSite: 'lax',
        maxAge: input.authConfig.sessionTtlSeconds,
      });
      return { user: result.user };
    },
  );
  input.app.post('/auth/logout', async (request, reply) => {
    const sessionId: string | undefined = request.cookies[input.authConfig.sessionCookieName];
    await input.authService.logout({ sessionId });
    reply.clearCookie(input.authConfig.sessionCookieName, {
      path: '/',
      httpOnly: true,
      secure: input.authConfig.isCookieSecure,
      sameSite: 'lax',
    });
    return reply.code(204).send();
  });
  input.app.post(
    '/auth/change-password',
    {
      schema: {
        body: changePasswordBodySchema,
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionId: string | undefined = request.cookies[input.authConfig.sessionCookieName];
      const user = await input.authService.getSession({ sessionId, now: new Date() });
      if (user === undefined) {
        return reply.code(401).send(buildAuthRequiredErrorBody({ requestId: String(request.id) }));
      }
      const body = request.body as { readonly currentPassword: string; readonly newPassword: string };
      const result = await input.authService.changePassword({
        username: user.username,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        now: new Date(),
      });
      if (result.outcome === 'invalid_current') {
        return reply
          .code(400)
          .send(
            buildValidationErrorBody({
              requestId: String(request.id),
              code: 'AUTH_PASSWORD_CHANGE_REJECTED',
              message: 'Could not change password.',
            }),
          );
      }
      return reply.code(204).send();
    },
  );
  input.app.get(
    '/auth/session',
    {
      schema: {
        response: {
          200: {
            oneOf: [sessionOkSchema, sessionAnonymousSchema],
          },
        },
      },
    },
    async (request) => {
      const sessionId: string | undefined = request.cookies[input.authConfig.sessionCookieName];
      const user = await input.authService.getSession({ sessionId, now: new Date() });
      if (user === undefined) {
        return { authenticated: false as const };
      }
      return { authenticated: true as const, user };
    },
  );
}

/**
 * Requires a valid session cookie; sets `request.authUser` when successful.
 */
export function createRequireSessionPreHandler(input: {
  readonly authService: AuthService;
  readonly authConfig: AuthConfig;
}): preHandlerHookHandler {
  const handler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const sessionId: string | undefined = request.cookies[input.authConfig.sessionCookieName];
    const user = await input.authService.getSession({ sessionId, now: new Date() });
    if (user === undefined) {
      await reply.code(401).send(buildAuthRequiredErrorBody({ requestId: String(request.id) }));
      return;
    }
    request.authUser = user;
  };
  return handler as preHandlerHookHandler;
}
