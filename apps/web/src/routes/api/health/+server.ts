import { json, type RequestHandler } from '@sveltejs/kit';

type HealthProxyResponseBody = Readonly<{ readonly ok: boolean }>;

function getApiBaseUrl(): string {
  return process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
}

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const response: Response = await fetch(`${getApiBaseUrl().replace(/\/+$/, '')}/health`, { method: 'GET' });
    const body: HealthProxyResponseBody = { ok: response.ok };
    return json(body, { status: response.ok ? 200 : 503 });
  } catch {
    return json({ ok: false } satisfies HealthProxyResponseBody, { status: 503 });
  }
};

