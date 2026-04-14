import { createHash } from 'crypto';

/**
 * Returns 32-byte AES key material derived from `API_AI_SETTINGS_SECRET` (any string; hashed with SHA-256).
 * When unset, user AI settings persistence is disabled (routes return a clear configuration error).
 */
export function getAiSettingsEncryptionKeyBytes(): Buffer | undefined {
  const raw: string | undefined = process.env['API_AI_SETTINGS_SECRET'];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  return createHash('sha256').update(raw.trim(), 'utf8').digest();
}
