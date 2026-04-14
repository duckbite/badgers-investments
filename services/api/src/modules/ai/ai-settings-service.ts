import { getAiSettingsEncryptionKeyBytes } from '../../config/get-ai-settings-encryption-key.js';
import { decryptAiSettingsSecret, encryptAiSettingsSecret } from './ai-settings-cipher.js';
import { getResolvedAiModelIdForProvider } from './resolve-ai-model-id.js';
import type { UserAiSettingsRepository } from './user-ai-settings-repository.js';
import type { AiProviderKind } from './verify-ai-provider-connection.js';
import { verifyAiProviderConnection } from './verify-ai-provider-connection.js';

const ALLOWED_PROVIDERS: ReadonlySet<AiProviderKind> = new Set(['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI']);

export type UserAiSettingsPublicDto = {
  readonly provider: AiProviderKind;
  readonly modelId: string;
  readonly apiKeyMasked: string | null;
  readonly hasStoredApiKey: boolean;
  readonly lastVerifyOk: boolean | null;
  readonly lastVerifiedAt: string | null;
  readonly updatedAt: string | null;
};

export type UserAiSettingsPutBody = {
  readonly provider: AiProviderKind;
  /** When set, replaces the stored key. Empty string removes stored credentials. Omit to keep the existing secret. */
  readonly apiKey?: string;
};

export class AiSettingsServiceError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

export class AiSettingsService {
  private readonly userAiSettingsRepository: UserAiSettingsRepository;

  public constructor(input: { readonly userAiSettingsRepository: UserAiSettingsRepository }) {
    this.userAiSettingsRepository = input.userAiSettingsRepository;
  }

  public async getForUser(input: { readonly userId: string }): Promise<UserAiSettingsPublicDto> {
    const record = await this.userAiSettingsRepository.getByUserId({ userId: input.userId });
    if (record === undefined || record.apiKeyCipherTextBase64.length === 0) {
      const provider: AiProviderKind = 'OPENAI';
      return {
        provider,
        modelId: getResolvedAiModelIdForProvider(provider),
        apiKeyMasked: null,
        hasStoredApiKey: false,
        lastVerifyOk: null,
        lastVerifiedAt: null,
        updatedAt: null,
      };
    }
    const provider: AiProviderKind = normalizeProvider({ raw: record.aiProvider });
    return {
      provider,
      modelId: getResolvedAiModelIdForProvider(provider),
      apiKeyMasked: '••••••••••••••••',
      hasStoredApiKey: true,
      lastVerifyOk: record.lastVerifyOk === undefined ? null : record.lastVerifyOk,
      lastVerifiedAt: record.lastVerifiedAtIso ?? null,
      updatedAt: record.updatedAtIso,
    };
  }

  public async putForUser(input: { readonly userId: string; readonly body: UserAiSettingsPutBody; readonly now: Date }): Promise<UserAiSettingsPublicDto> {
    const keyMaterial: Buffer | undefined = getAiSettingsEncryptionKeyBytes();
    if (keyMaterial === undefined) {
      throw new AiSettingsServiceError({
        code: 'AI_SETTINGS_ENCRYPTION_UNAVAILABLE',
        message: 'Server is not configured to store AI API keys (set API_AI_SETTINGS_SECRET).',
      });
    }
    const provider: AiProviderKind = normalizeProvider({ raw: input.body.provider });
    if (!ALLOWED_PROVIDERS.has(provider)) {
      throw new AiSettingsServiceError({ code: 'AI_SETTINGS_PROVIDER_INVALID', message: 'AI provider is not supported.' });
    }
    const modelId: string = getResolvedAiModelIdForProvider(provider);
    const existing = await this.userAiSettingsRepository.getByUserId({ userId: input.userId });
    const hasStoredCipher: boolean =
      existing !== undefined &&
      existing.apiKeyCipherTextBase64.length > 0 &&
      existing.apiKeyIvBase64.length > 0 &&
      existing.apiKeyAuthTagBase64.length > 0;
    if (input.body.apiKey !== undefined && input.body.apiKey.trim().length === 0) {
      if (existing !== undefined) {
        await this.userAiSettingsRepository.deleteByUserId({ userId: input.userId });
      }
      return {
        provider,
        modelId,
        apiKeyMasked: null,
        hasStoredApiKey: false,
        lastVerifyOk: null,
        lastVerifiedAt: null,
        updatedAt: null,
      };
    }
    let cipher: { readonly ciphertextBase64: string; readonly ivBase64: string; readonly authTagBase64: string };
    if (input.body.apiKey !== undefined) {
      cipher = encryptAiSettingsSecret({ plaintextUtf8: input.body.apiKey.trim(), key: keyMaterial });
    } else if (hasStoredCipher && existing !== undefined) {
      cipher = {
        ciphertextBase64: existing.apiKeyCipherTextBase64,
        ivBase64: existing.apiKeyIvBase64,
        authTagBase64: existing.apiKeyAuthTagBase64,
      };
    } else {
      return {
        provider,
        modelId,
        apiKeyMasked: null,
        hasStoredApiKey: false,
        lastVerifyOk: null,
        lastVerifiedAt: null,
        updatedAt: null,
      };
    }
    const updatedAtIso: string = input.now.toISOString();
    await this.userAiSettingsRepository.put({
      record: {
        userId: input.userId,
        aiProvider: provider,
        modelId,
        apiKeyCipherTextBase64: cipher.ciphertextBase64,
        apiKeyIvBase64: cipher.ivBase64,
        apiKeyAuthTagBase64: cipher.authTagBase64,
        updatedAtIso,
        ...(existing?.lastVerifyOk === undefined ? {} : { lastVerifyOk: existing.lastVerifyOk }),
        ...(existing?.lastVerifiedAtIso === undefined ? {} : { lastVerifiedAtIso: existing.lastVerifiedAtIso }),
      },
    });
    return this.getForUser({ userId: input.userId });
  }

  public async verifyForUser(input: { readonly userId: string; readonly now: Date }): Promise<{ readonly ok: boolean }> {
    const keyMaterial: Buffer | undefined = getAiSettingsEncryptionKeyBytes();
    if (keyMaterial === undefined) {
      throw new AiSettingsServiceError({
        code: 'AI_SETTINGS_ENCRYPTION_UNAVAILABLE',
        message: 'Server is not configured to store AI API keys (set API_AI_SETTINGS_SECRET).',
      });
    }
    const record = await this.userAiSettingsRepository.getByUserId({ userId: input.userId });
    if (record === undefined || record.apiKeyCipherTextBase64.length === 0) {
      throw new AiSettingsServiceError({ code: 'AI_SETTINGS_KEY_MISSING', message: 'No API key is stored for this account.' });
    }
    const provider: AiProviderKind = normalizeProvider({ raw: record.aiProvider });
    const apiKey: string = decryptAiSettingsSecret({
      key: keyMaterial,
      payload: {
        ciphertextBase64: record.apiKeyCipherTextBase64,
        ivBase64: record.apiKeyIvBase64,
        authTagBase64: record.apiKeyAuthTagBase64,
      },
    });
    const result = await verifyAiProviderConnection({ provider, apiKey });
    const ok: boolean = result.ok === true;
    await this.userAiSettingsRepository.put({
      record: {
        ...record,
        lastVerifyOk: ok,
        lastVerifiedAtIso: input.now.toISOString(),
        updatedAtIso: input.now.toISOString(),
      },
    });
    return { ok };
  }
}

function normalizeProvider(input: { readonly raw: string }): AiProviderKind {
  const upper: string = input.raw.trim().toUpperCase();
  if (upper === 'GOOGLE' || upper === 'GEMINI') {
    return 'GOOGLE_GEMINI';
  }
  if (upper === 'CLAUDE') {
    return 'ANTHROPIC';
  }
  if (upper === 'OPENAI' || upper === 'ANTHROPIC' || upper === 'GOOGLE_GEMINI') {
    return upper;
  }
  return 'OPENAI';
}
