type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ApiClientOptions = Readonly<{
  readonly baseUrl: string;
  readonly fetchFunction?: typeof fetch;
}>;

type ApiRequestOptions<TBody> = Readonly<{
  readonly method: HttpMethod;
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: TBody;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}>;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFunction: typeof fetch;

  public constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchFunction = options.fetchFunction ?? fetch;
  }

  public async executeJson<TResponse, TBody = undefined>(options: ApiRequestOptions<TBody>): Promise<TResponse> {
    const url: URL = this.buildUrl({ path: options.path, query: options.query });
    const response: Response = await this.fetchFunction(url.toString(), {
      method: options.method,
      headers: this.buildHeaders({ headers: options.headers, hasBody: options.body !== undefined }),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: 'include',
    });
    if (response.ok) {
      if (response.status === 204) {
        return undefined as TResponse;
      }
      const text: string = await response.text();
      if (text.length === 0) {
        return undefined as TResponse;
      }
      return JSON.parse(text) as TResponse;
    }
    const errorPayload: unknown = await this.tryParseJson(response);
    const message: string = this.resolveErrorMessage({ response, errorPayload });
    throw new Error(message);
  }

  private buildUrl(options: Readonly<{ readonly path: string; readonly query?: ApiRequestOptions<unknown>['query'] }>): URL {
    const normalizedPath: string = options.path.startsWith('/') ? options.path : `/${options.path}`;
    const url: URL = new URL(`${this.baseUrl}${normalizedPath}`);
    if (!options.query) {
      return url;
    }
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url;
  }

  private buildHeaders(options: Readonly<{ readonly headers?: ApiRequestOptions<unknown>['headers']; readonly hasBody: boolean }>): HeadersInit {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (options.hasBody) {
      headers['content-type'] = headers['content-type'] ?? 'application/json';
    }
    headers['accept'] = headers['accept'] ?? 'application/json';
    return headers;
  }

  private async tryParseJson(response: Response): Promise<unknown> {
    const contentType: string | null = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return undefined;
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      return undefined;
    }
  }

  private resolveErrorMessage(options: Readonly<{ readonly response: Response; readonly errorPayload: unknown }>): string {
    const payload: unknown = options.errorPayload;
    if (typeof payload === 'object' && payload !== null) {
      const record: Record<string, unknown> = payload as Record<string, unknown>;
      const nestedError: unknown = record['error'];
      if (typeof nestedError === 'object' && nestedError !== null) {
        const nestedMessage: unknown = (nestedError as Record<string, unknown>)['message'];
        if (typeof nestedMessage === 'string' && nestedMessage.length > 0) {
          return nestedMessage;
        }
      }
      const topMessage: unknown = record['message'];
      if (typeof topMessage === 'string' && topMessage.length > 0) {
        return topMessage;
      }
    }
    return `Request failed (${options.response.status} ${options.response.statusText})`;
  }
}

