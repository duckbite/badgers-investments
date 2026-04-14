import Anthropic, { APIError } from '@anthropic-ai/sdk';

export type AnthropicRecommendationLlmRequest = {
  readonly apiKey: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
};

/**
 * Calls Claude via the official Anthropic SDK and returns assistant text (expected to be JSON for downstream parsing).
 */
export async function requestAnthropicRecommendationJson(input: AnthropicRecommendationLlmRequest): Promise<string> {
  const client: Anthropic = new Anthropic({ apiKey: input.apiKey });
  try {
    const message = await client.messages.create({
      model: input.model,
      max_tokens: 4096,
      temperature: 0.2,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    });
    const parts: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        parts.push(block.text);
      }
    }
    if (parts.length === 0) {
      throw new Error('Anthropic response missing text.');
    }
    return parts.join('');
  } catch (err) {
    if (err instanceof APIError) {
      const detail: string = err.message.trim();
      const status: number | undefined = typeof err.status === 'number' ? err.status : undefined;
      const statusLabel: string = status !== undefined ? String(status) : 'error';
      throw new Error(
        detail.length > 0 ? `Anthropic request failed (${statusLabel}): ${detail}` : `Anthropic request failed (${statusLabel}).`,
      );
    }
    throw err;
  }
}
