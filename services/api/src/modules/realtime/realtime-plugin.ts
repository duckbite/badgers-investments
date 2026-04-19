import websocket from '@fastify/websocket';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { RecommendationRunSummaryDto } from '../recommendations/recommendation-run-service.js';
import type { AnalysisRunSummaryDto } from '../analysis/analysis-types.js';

const MAX_RECOMMENDATION_RUNS: number = 50;
const MAX_ANALYSIS_RUNS: number = 50;
const PUSH_INTERVAL_MS: number = 2500;
const WEB_SOCKET_OPEN_STATE: number = 1;

type RecommendationRunStatusEvent = {
  readonly eventType: 'run.status';
  readonly domain: 'recommendation';
  readonly runId: string;
  readonly type: 'recommendation-run';
  readonly status: string;
  readonly occurredAt: string;
  readonly summary: RecommendationRunSummaryDto;
};

type AnalysisRunStatusEvent = {
  readonly eventType: 'run.status';
  readonly domain: 'analysis';
  readonly runId: string;
  readonly type: string;
  readonly status: string;
  readonly occurredAt: string;
  readonly summary: AnalysisRunSummaryDto;
};

type RealtimeConnectionStateEvent = {
  readonly eventType: 'connection.state';
  readonly state: 'connected' | 'degraded';
  readonly occurredAt: string;
};

type RealtimeEvent = RecommendationRunStatusEvent | AnalysisRunStatusEvent | RealtimeConnectionStateEvent;

type WebSocketLike = {
  readonly readyState: number;
  send: (payload: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (eventName: 'close' | 'error', handler: () => void) => void;
};

type RecommendationRunSnapshot = {
  readonly signatureByRunId: ReadonlyMap<string, string>;
  readonly runById: ReadonlyMap<string, RecommendationRunSummaryDto>;
};

type AnalysisRunSnapshot = {
  readonly signatureByRunId: ReadonlyMap<string, string>;
  readonly runById: ReadonlyMap<string, AnalysisRunSummaryDto>;
};

function buildRunSignature(input: { readonly run: RecommendationRunSummaryDto }): string {
  return [
    input.run.runStatus,
    input.run.currentStep ?? '',
    input.run.completedAt ?? '',
    input.run.runItemCount.toString(),
    input.run.runActionableCount.toString(),
    input.run.runMaxStrengthScore ?? '',
    input.run.portfolioLevelSummary,
  ].join('|');
}

function buildAnalysisRunSignature(input: { readonly run: AnalysisRunSummaryDto }): string {
  return [input.run.status, input.run.currentStep ?? '', input.run.completedAt ?? '', input.run.reportId ?? '', input.run.summary].join('|');
}

function buildRunSnapshot(input: {
  readonly runs: readonly RecommendationRunSummaryDto[];
}): RecommendationRunSnapshot {
  const signatureByRunId: Map<string, string> = new Map<string, string>();
  const runById: Map<string, RecommendationRunSummaryDto> = new Map<string, RecommendationRunSummaryDto>();
  for (const run of input.runs) {
    signatureByRunId.set(run.runId, buildRunSignature({ run }));
    runById.set(run.runId, run);
  }
  return { signatureByRunId, runById };
}

function buildAnalysisRunSnapshot(input: { readonly runs: readonly AnalysisRunSummaryDto[] }): AnalysisRunSnapshot {
  const signatureByRunId: Map<string, string> = new Map<string, string>();
  const runById: Map<string, AnalysisRunSummaryDto> = new Map<string, AnalysisRunSummaryDto>();
  for (const run of input.runs) {
    signatureByRunId.set(run.runId, buildAnalysisRunSignature({ run }));
    runById.set(run.runId, run);
  }
  return { signatureByRunId, runById };
}

function selectChangedRuns(input: {
  readonly previous: RecommendationRunSnapshot;
  readonly current: RecommendationRunSnapshot;
}): readonly RecommendationRunSummaryDto[] {
  const changed: RecommendationRunSummaryDto[] = [];
  for (const [runId, nextSignature] of input.current.signatureByRunId.entries()) {
    const previousSignature: string | undefined = input.previous.signatureByRunId.get(runId);
    if (previousSignature === nextSignature) {
      continue;
    }
    const run: RecommendationRunSummaryDto | undefined = input.current.runById.get(runId);
    if (run !== undefined) {
      changed.push(run);
    }
  }
  return changed;
}

function selectChangedAnalysisRuns(input: {
  readonly previous: AnalysisRunSnapshot;
  readonly current: AnalysisRunSnapshot;
}): readonly AnalysisRunSummaryDto[] {
  const changed: AnalysisRunSummaryDto[] = [];
  for (const [runId, nextSignature] of input.current.signatureByRunId.entries()) {
    const previousSignature: string | undefined = input.previous.signatureByRunId.get(runId);
    if (previousSignature === nextSignature) {
      continue;
    }
    const run: AnalysisRunSummaryDto | undefined = input.current.runById.get(runId);
    if (run !== undefined) {
      changed.push(run);
    }
  }
  return changed;
}

function buildRecommendationRunEvent(input: { readonly run: RecommendationRunSummaryDto }): RecommendationRunStatusEvent {
  return {
    eventType: 'run.status',
    domain: 'recommendation',
    runId: input.run.runId,
    type: 'recommendation-run',
    status: input.run.runStatus,
    occurredAt: new Date().toISOString(),
    summary: input.run,
  };
}

function buildAnalysisRunEvent(input: { readonly run: AnalysisRunSummaryDto }): AnalysisRunStatusEvent {
  return {
    eventType: 'run.status',
    domain: 'analysis',
    runId: input.run.runId,
    type: input.run.type,
    status: input.run.status,
    occurredAt: new Date().toISOString(),
    summary: input.run,
  };
}

function isWebSocketLike(input: unknown): input is WebSocketLike {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  const candidate: Partial<WebSocketLike> = input as Partial<WebSocketLike>;
  return (
    typeof candidate.readyState === 'number' &&
    typeof candidate.send === 'function' &&
    typeof candidate.close === 'function' &&
    typeof candidate.on === 'function'
  );
}

function sendRealtimeEvent(input: { readonly socket: WebSocketLike; readonly event: RealtimeEvent }): void {
  if (input.socket.readyState !== WEB_SOCKET_OPEN_STATE) {
    return;
  }
  input.socket.send(JSON.stringify(input.event));
}

const realtimePluginImpl: FastifyPluginAsync = async (app): Promise<void> => {
  await app.register(websocket);
  app.get(
    '/realtime/ws',
    {
      websocket: true,
      preHandler: app.requireSession,
    },
    (socket: unknown, request: FastifyRequest) => {
      if (!isWebSocketLike(socket)) {
        return;
      }
      const userId: string = request.authUser?.userId ?? '';
      if (userId.length === 0) {
        socket.close(1008, 'Unauthorized');
        return;
      }
      let isClosed: boolean = false;
      let isSyncing: boolean = false;
      let previousSnapshot: RecommendationRunSnapshot = buildRunSnapshot({ runs: [] });
      let previousAnalysisSnapshot: AnalysisRunSnapshot = buildAnalysisRunSnapshot({ runs: [] });
      sendRealtimeEvent({
        socket,
        event: { eventType: 'connection.state', state: 'connected', occurredAt: new Date().toISOString() },
      });
      const pushUpdates = async (): Promise<void> => {
        if (isClosed || isSyncing) {
          return;
        }
        isSyncing = true;
        try {
          const runs = await app.recommendationRunService.listRuns({ userId, now: new Date(), limit: MAX_RECOMMENDATION_RUNS });
          const nextSnapshot: RecommendationRunSnapshot = buildRunSnapshot({ runs });
          const changedRuns: readonly RecommendationRunSummaryDto[] = selectChangedRuns({
            previous: previousSnapshot,
            current: nextSnapshot,
          });
          const analysisRuns = await app.analysisRunService.listRuns({ userId, now: new Date(), limit: MAX_ANALYSIS_RUNS });
          const nextAnalysisSnapshot: AnalysisRunSnapshot = buildAnalysisRunSnapshot({ runs: analysisRuns });
          const changedAnalysisRuns: readonly AnalysisRunSummaryDto[] = selectChangedAnalysisRuns({
            previous: previousAnalysisSnapshot,
            current: nextAnalysisSnapshot,
          });
          previousSnapshot = nextSnapshot;
          previousAnalysisSnapshot = nextAnalysisSnapshot;
          for (const run of changedRuns) {
            sendRealtimeEvent({ socket, event: buildRecommendationRunEvent({ run }) });
          }
          for (const run of changedAnalysisRuns) {
            sendRealtimeEvent({ socket, event: buildAnalysisRunEvent({ run }) });
          }
        } catch {
          sendRealtimeEvent({
            socket,
            event: { eventType: 'connection.state', state: 'degraded', occurredAt: new Date().toISOString() },
          });
        } finally {
          isSyncing = false;
        }
      };
      const timer: NodeJS.Timeout = setInterval(() => {
        void pushUpdates();
      }, PUSH_INTERVAL_MS);
      const dispose = (): void => {
        if (isClosed) {
          return;
        }
        isClosed = true;
        clearInterval(timer);
      };
      void pushUpdates();
      socket.on('close', () => {
        dispose();
      });
      socket.on('error', () => {
        dispose();
      });
    },
  );
};

export const realtimePlugin = fp(realtimePluginImpl, {
  name: 'realtime',
  dependencies: ['auth-domain', 'domain-data'],
});
