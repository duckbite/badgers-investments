export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'degraded';

export type RealtimeRecommendationRunEvent = {
  readonly eventType: 'run.status';
  readonly domain: 'recommendation' | 'analysis';
  readonly runId: string;
  readonly type: string;
  readonly status: string;
  readonly occurredAt: string;
  readonly summary?: unknown;
};

type RealtimeConnectionStateEvent = {
  readonly eventType: 'connection.state';
  readonly state: 'connected' | 'degraded';
  readonly occurredAt: string;
};

type RealtimeEvent = RealtimeRecommendationRunEvent | RealtimeConnectionStateEvent;

const RECONNECT_DELAYS_MS: readonly number[] = [500, 1000, 2000, 4000, 8000];
const MAX_RECONNECT_DELAY_MS: number = 12000;

function toRealtimeUrl(input: { readonly apiBaseUrl: string }): string {
  const parsed: URL = new URL(input.apiBaseUrl);
  parsed.pathname = '/realtime/ws';
  parsed.search = '';
  parsed.hash = '';
  if (parsed.protocol === 'https:') {
    parsed.protocol = 'wss:';
  } else if (parsed.protocol === 'http:') {
    parsed.protocol = 'ws:';
  }
  return parsed.toString();
}

function parseEvent(input: { readonly data: string }): RealtimeEvent | undefined {
  try {
    const parsed: unknown = JSON.parse(input.data);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const eventType: unknown = (parsed as { readonly eventType?: unknown }).eventType;
    if (eventType === 'run.status') {
      return parsed as RealtimeRecommendationRunEvent;
    }
    if (eventType === 'connection.state') {
      return parsed as RealtimeConnectionStateEvent;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function createRecommendationRunsFeed(input: {
  readonly apiBaseUrl: string;
  readonly onRecommendationEvent: (event: RealtimeRecommendationRunEvent) => void;
  readonly onConnectionStatus: (status: RealtimeConnectionStatus) => void;
  readonly onReconnect: () => void | Promise<void>;
}): { readonly close: () => void } {
  if (typeof window === 'undefined') {
    return { close: () => undefined };
  }
  let isClosed: boolean = false;
  let socket: WebSocket | undefined;
  let reconnectAttempt: number = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let hasConnectedAtLeastOnce: boolean = false;

  const clearReconnectTimer = (): void => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const scheduleReconnect = (): void => {
    if (isClosed) {
      return;
    }
    const idx: number = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
    const delay: number = Math.min(RECONNECT_DELAYS_MS[idx], MAX_RECONNECT_DELAY_MS);
    reconnectAttempt += 1;
    input.onConnectionStatus('reconnecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  };

  const handleOpen = (): void => {
    reconnectAttempt = 0;
    input.onConnectionStatus('connected');
    if (hasConnectedAtLeastOnce) {
      void input.onReconnect();
    }
    hasConnectedAtLeastOnce = true;
  };

  const handleMessage = (rawData: string): void => {
    const event: RealtimeEvent | undefined = parseEvent({ data: rawData });
    if (event === undefined) {
      return;
    }
    if (event.eventType === 'run.status') {
      if (event.domain === 'recommendation') {
        input.onRecommendationEvent(event);
      }
      return;
    }
    if (event.state === 'degraded') {
      input.onConnectionStatus('degraded');
    } else {
      input.onConnectionStatus('connected');
    }
  };

  const connect = (): void => {
    if (isClosed) {
      return;
    }
    clearReconnectTimer();
    input.onConnectionStatus(hasConnectedAtLeastOnce ? 'reconnecting' : 'connecting');
    const wsUrl: string = toRealtimeUrl({ apiBaseUrl: input.apiBaseUrl });
    socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => {
      handleOpen();
    });
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      handleMessage(event.data);
    });
    socket.addEventListener('close', () => {
      socket = undefined;
      if (!isClosed) {
        scheduleReconnect();
      }
    });
    socket.addEventListener('error', () => {
      input.onConnectionStatus('degraded');
    });
  };

  connect();

  const close = (): void => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    clearReconnectTimer();
    if (socket !== undefined) {
      socket.close();
      socket = undefined;
    }
    input.onConnectionStatus('idle');
  };

  return { close };
}
