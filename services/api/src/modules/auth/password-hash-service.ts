import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_V1_PREFIX: string = 'scrypt$v1$';
const SCRYPT_N: number = 16384;
const SCRYPT_r: number = 8;
const SCRYPT_p: number = 1;
const DERIVED_KEY_LENGTH: number = 64;

/**
 * Produces a one-way password hash suitable for storage in DynamoDB (scrypt).
 */
export function hashPassword(plaintextPassword: string): string {
  const salt: Buffer = randomBytes(16);
  const derived: Buffer = scryptSync(plaintextPassword, salt, DERIVED_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return `${SCRYPT_V1_PREFIX}${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using a constant-time comparison.
 */
export function verifyPassword(input: { readonly plaintextPassword: string; readonly storedHash: string }): boolean {
  if (!input.storedHash.startsWith(SCRYPT_V1_PREFIX)) {
    return false;
  }
  const payload: string = input.storedHash.slice(SCRYPT_V1_PREFIX.length);
  const separatorIndex: number = payload.indexOf('$');
  if (separatorIndex <= 0) {
    return false;
  }
  const saltBase64Url: string = payload.slice(0, separatorIndex);
  const expectedBase64Url: string = payload.slice(separatorIndex + 1);
  if (expectedBase64Url.length === 0) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltBase64Url, 'base64url');
    expected = Buffer.from(expectedBase64Url, 'base64url');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  let derived: Buffer;
  try {
    derived = scryptSync(input.plaintextPassword, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_r,
      p: SCRYPT_p,
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
