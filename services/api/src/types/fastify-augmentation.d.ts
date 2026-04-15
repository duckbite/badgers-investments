import type { preHandlerHookHandler } from 'fastify';
import type { RecommendationRunService } from '../modules/recommendations/recommendation-run-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    readonly requireSession: preHandlerHookHandler;
    readonly recommendationRunService: RecommendationRunService;
  }
  interface FastifyRequest {
    authUser?: { readonly userId: string; readonly username: string };
  }
}
