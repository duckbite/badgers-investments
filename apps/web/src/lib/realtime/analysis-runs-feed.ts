import type { AnalysisRunSummary } from '$lib/api/analysis';

export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'degraded';

type AnalysisRunStatusEvent = {
  readonly eventType: 'run.status';
  readonly domain: 'analysis';
  readonly runId: string;
  readonly type: string;
  readonly status: string;
  readonly occurredAt: string;
  readonly summary?: AnalysisRunSummary;
};

type ConnectionStateEvent = {
  readonly eventType: 'connection.state';
  readonly state: 'connected' | 'degraded';
  readonly occurredAt: string;
};

type RealtimeEvent = AnalysisRunStatusEvent | ConnectionStateEvent;

const RECONNECT_DELAYS_MS: readonly number[] = [500, 1000, 2000, 4000, 8000];

function toRealtimeUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
  url.pathname = '/realtime/ws';
  if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

function parseEvent(raw: string): RealtimeEvent | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const eventType: unknown = (parsed as { readonly eventType?: unknown }).eventType;
    if (eventType === 'run.status' || eventType === 'connection.state') {
      return parsed as RealtimeEvent;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function createAnalysisRunsFeed(input: {
  readonly apiBaseUrl: string;
  readonly onRunEvent: (event: AnalysisRunStatusEvent) => void;
  readonly onConnectionStatus: (status: RealtimeConnectionStatus) => void;
  readonly onReconnect: () => void | Promise<void>;
}): { readonly close: () => void } {
  if (typeof window === 'undefined') {
    return { close: () => undefined };
  }
  let closed = false;
  let socket: WebSocket | undefined;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let hasConnected = false;

  const clearTimer = (): void => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const connect = (): void => {
    if (closed) {
      return;
    }
    clearTimer();
    input.onConnectionStatus(hasConnected ? 'reconnecting' : 'connecting');
    socket = new WebSocket(toRealtimeUrl(input.apiBaseUrl));
    socket.addEventListener('open', () => {
      reconnectAttempt = 0;
      input.onConnectionStatus('connected');
      if (hasConnected) {
        void input.onReconnect();
      }
      hasConnected = true;
    });
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      const parsed = parseEvent(event.data);
      if (parsed === undefined) {
        return;
      }
      if (parsed.eventType === 'connection.state') {
        input.onConnectionStatus(parsed.state === 'degraded' ? 'degraded' : 'connected');
        return;
      }
      if (parsed.domain === 'analysis') {
        input.onRunEvent(parsed);
      }
    });
    socket.addEventListener('close', () => {
      socket = undefined;
      if (closed) {
        return;
      }
      const idx = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
      const delay = RECONNECT_DELAYS_MS[idx];
      reconnectAttempt += 1;
      input.onConnectionStatus('reconnecting');
      reconnectTimer = setTimeout(connect, delay);
    });
    socket.addEventListener('error', () => {
      input.onConnectionStatus('degraded');
    });
  };

  connect();

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    clearTimer();
    if (socket !== undefined) {
      socket.close();
      socket = undefined;
    }
    input.onConnectionStatus('idle');
  };

  return { close };
}
