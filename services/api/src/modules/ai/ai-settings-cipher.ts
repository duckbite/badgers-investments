import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Literal algorithm so `createCipheriv` resolves to the GCM overload (`authTagLength` allowed). */
const AES_ALGO = 'aes-256-gcm' as const;
const IV_LENGTH: number = 12;
const AUTH_TAG_LENGTH: number = 16;

export type AiSettingsCipherPayload = {
  readonly ciphertextBase64: string;
  readonly ivBase64: string;
  readonly authTagBase64: string;
};

export function encryptAiSettingsSecret(input: { readonly plaintextUtf8: string; readonly key: Buffer }): AiSettingsCipherPayload {
  const iv: Buffer = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGO, input.key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted: Buffer = Buffer.concat([cipher.update(input.plaintextUtf8, 'utf8'), cipher.final()]);
  const authTag: Buffer = cipher.getAuthTag();
  return {
    ciphertextBase64: encrypted.toString('base64'),
    ivBase64: iv.toString('base64'),
    authTagBase64: authTag.toString('base64'),
  };
}

export function decryptAiSettingsSecret(input: { readonly payload: AiSettingsCipherPayload; readonly key: Buffer }): string {
  const iv: Buffer = Buffer.from(input.payload.ivBase64, 'base64');
  const authTag: Buffer = Buffer.from(input.payload.authTagBase64, 'base64');
  const ciphertext: Buffer = Buffer.from(input.payload.ciphertextBase64, 'base64');
  const decipher = createDecipheriv(AES_ALGO, input.key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
