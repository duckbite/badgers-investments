import { getAiSettingsEncryptionKeyBytes } from '../../config/get-ai-settings-encryption-key.js';
import { decryptAiSettingsSecret } from './ai-settings-cipher.js';
import { getResolvedAnthropicModelId } from './resolve-ai-model-id.js';
import type { UserAiSettingsRepository } from './user-ai-settings-repository.js';
import type { AiProviderKind } from './verify-ai-provider-connection.js';

export type ResolvedUserAiCredentials = {
  readonly provider: AiProviderKind;
  readonly apiKey: string;
  readonly modelId: string;
};

/**
 * Decrypts stored AI credentials for server-side recommendation synthesis (MVP: Anthropic only).
 */
export async function tryResolveUserAiCredentials(input: {
  readonly userAiSettingsRepository: UserAiSettingsRepository;
  readonly userId: string;
}): Promise<ResolvedUserAiCredentials | undefined> {
  const keyMaterial: Buffer | undefined = getAiSettingsEncryptionKeyBytes();
  if (keyMaterial === undefined) {
    return undefined;
  }
  const record = await input.userAiSettingsRepository.getByUserId({ userId: input.userId });
  if (record === undefined || record.apiKeyCipherTextBase64.length === 0) {
    return undefined;
  }
  const provider: AiProviderKind = 'ANTHROPIC';
  const apiKey: string = decryptAiSettingsSecret({
    key: keyMaterial,
    payload: {
      ciphertextBase64: record.apiKeyCipherTextBase64,
      ivBase64: record.apiKeyIvBase64,
      authTagBase64: record.apiKeyAuthTagBase64,
    },
  });
  const modelId: string = getResolvedAnthropicModelId();
  return { provider, apiKey, modelId };
}
