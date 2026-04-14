import { describe, expect, it } from 'vitest';
import { decryptAiSettingsSecret, encryptAiSettingsSecret } from './ai-settings-cipher.js';

describe('aiSettingsCipher', () => {
  it('round-trips UTF-8 secrets', () => {
    const key: Buffer = Buffer.alloc(32, 7);
    const payload = encryptAiSettingsSecret({ plaintextUtf8: 'sk-test-abc', key });
    const actual: string = decryptAiSettingsSecret({ payload, key });
    expect(actual).toBe('sk-test-abc');
  });
});
