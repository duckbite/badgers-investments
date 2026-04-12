import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-hash-service.js';

describe('passwordHashService', () => {
  it('verifies a hash produced by hashPassword', () => {
    const plaintextPassword: string = 'correct horse battery staple';
    const storedHash: string = hashPassword(plaintextPassword);
    expect(verifyPassword({ plaintextPassword, storedHash })).toBe(true);
  });

  it('rejects wrong passwords', () => {
    const storedHash: string = hashPassword('one');
    expect(verifyPassword({ plaintextPassword: 'two', storedHash })).toBe(false);
  });

  it('rejects unknown hash formats', () => {
    expect(verifyPassword({ plaintextPassword: 'x', storedHash: 'bcrypt$foo' })).toBe(false);
  });

});
