export type AiProviderKind = 'ANTHROPIC';

/**
 * MVP: Anthropic (Claude) only. Verifies the API key against the Anthropic models list.
 */
export async function verifyAiProviderConnection(input: {
  readonly apiKey: string;
  readonly fetchFn?: typeof fetch;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly status: number }> {
  const fetchFn: typeof fetch = input.fetchFn ?? fetch;
  const key: string = input.apiKey.trim();
  if (key.length === 0) {
    return { ok: false, status: 400 };
  }
  try {
    const response: Response = await fetchFn('https://api.anthropic.com/v1/models?limit=1', {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    });
    return response.ok ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
