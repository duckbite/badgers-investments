import { afterEach, describe, expect, it } from 'vitest';
import { getResolvedAnthropicModelId } from './resolve-ai-model-id.js';

describe('getResolvedAnthropicModelId', () => {
  const keys: readonly string[] = ['API_AI_MODEL_ANTHROPIC'];

  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
  });

  it('uses API_AI_MODEL_ANTHROPIC when set', () => {
    process.env['API_AI_MODEL_ANTHROPIC'] = 'claude-haiku-4-5-20251001';
    expect(getResolvedAnthropicModelId()).toBe('claude-haiku-4-5-20251001');
  });

  it('falls back when env is unset', () => {
    expect(getResolvedAnthropicModelId()).toBe('claude-opus-4-6');
  });
});
