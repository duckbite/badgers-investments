import type { AiProviderKind } from './verify-ai-provider-connection.js';

const FALLBACK: Readonly<Record<AiProviderKind, string>> = {
  OPENAI: 'gpt-4o-mini',
  ANTHROPIC: 'claude-3-5-haiku-20241022',
  GOOGLE_GEMINI: 'gemini-1.5-flash',
};

/**
 * Model id used for recommendation AI calls per provider. Override via env:
 * `API_AI_MODEL_OPENAI`, `API_AI_MODEL_ANTHROPIC`, `API_AI_MODEL_GOOGLE_GEMINI`.
 */
export function getResolvedAiModelIdForProvider(provider: AiProviderKind): string {
  const raw: string | undefined = {
    OPENAI: process.env['API_AI_MODEL_OPENAI'],
    ANTHROPIC: process.env['API_AI_MODEL_ANTHROPIC'],
    GOOGLE_GEMINI: process.env['API_AI_MODEL_GOOGLE_GEMINI'],
  }[provider]?.trim();
  if (raw !== undefined && raw.length > 0) {
    return raw;
  }
  return FALLBACK[provider];
}
