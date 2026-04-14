/**
 * Server-only pepper for hashing the amount-reveal PIN (prepended before scrypt).
 * Prefer `API_PRIVACY_SECRET`; falls back to `API_AI_SETTINGS_SECRET` so one secret can secure both AI ciphertext and PIN hashing in small setups.
 */
export function getPrivacyPinPepper(): string | undefined {
  const primary: string | undefined = process.env['API_PRIVACY_SECRET'];
  if (primary !== undefined && primary.trim().length > 0) {
    return primary.trim();
  }
  const fallback: string | undefined = process.env['API_AI_SETTINGS_SECRET'];
  if (fallback !== undefined && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return undefined;
}
