const FALLBACK_ANTHROPIC: string = 'claude-opus-4-6';

/**
 * Claude model id for recommendation AI (MVP: Anthropic only).
 * Override via `API_AI_MODEL_ANTHROPIC`.
 */
export function getResolvedAnthropicModelId(): string {
  const raw: string | undefined = process.env['API_AI_MODEL_ANTHROPIC']?.trim();
  if (raw !== undefined && raw.length > 0) {
    return raw;
  }
  return FALLBACK_ANTHROPIC;
}
