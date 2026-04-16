import type { preHandlerHookHandler } from 'fastify';
import type { RecommendationRunService } from '../modules/recommendations/recommendation-run-service.js';
import type { AnalysisRunService } from '../modules/analysis/analysis-run-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    readonly requireSession: preHandlerHookHandler;
    readonly recommendationRunService: RecommendationRunService;
    readonly analysisRunService: AnalysisRunService;
  }
  interface FastifyRequest {
    authUser?: { readonly userId: string; readonly username: string };
  }
}
