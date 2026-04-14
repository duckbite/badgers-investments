export type AiProviderKind = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI';

export async function verifyAiProviderConnection(input: {
  readonly provider: AiProviderKind;
  readonly apiKey: string;
  readonly fetchFn?: typeof fetch;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly status: number }> {
  const fetchFn: typeof fetch = input.fetchFn ?? fetch;
  const key: string = input.apiKey.trim();
  if (key.length === 0) {
    return { ok: false, status: 400 };
  }
  try {
    if (input.provider === 'OPENAI') {
      const response: Response = await fetchFn('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { authorization: `Bearer ${key}` },
      });
      return response.ok ? { ok: true } : { ok: false, status: response.status };
    }
    if (input.provider === 'ANTHROPIC') {
      const response: Response = await fetchFn('https://api.anthropic.com/v1/models?limit=1', {
        method: 'GET',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
      });
      return response.ok ? { ok: true } : { ok: false, status: response.status };
    }
    const response: Response = await fetchFn(`https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`, {
      method: 'GET',
    });
    return response.ok ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
