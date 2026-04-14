import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResolvedAiModelIdForProvider } from './resolve-ai-model-id.js';

describe('getResolvedAiModelIdForProvider', () => {
  const keys: readonly string[] = ['API_AI_MODEL_OPENAI', 'API_AI_MODEL_ANTHROPIC', 'API_AI_MODEL_GOOGLE_GEMINI'];

  beforeEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
  });

  it('uses env override when set', () => {
    process.env['API_AI_MODEL_OPENAI'] = 'gpt-4o';
    expect(getResolvedAiModelIdForProvider('OPENAI')).toBe('gpt-4o');
  });

  it('falls back when env unset', () => {
    expect(getResolvedAiModelIdForProvider('OPENAI')).toBe('gpt-4o-mini');
    expect(getResolvedAiModelIdForProvider('ANTHROPIC')).toBe('claude-3-5-haiku-20241022');
    expect(getResolvedAiModelIdForProvider('GOOGLE_GEMINI')).toBe('gemini-1.5-flash');
  });
});
