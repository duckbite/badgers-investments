import type { preHandlerHookHandler } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    readonly requireSession: preHandlerHookHandler;
  }
  interface FastifyRequest {
    authUser?: { readonly userId: string; readonly username: string };
  }
}
