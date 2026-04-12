import { describe, expect, it } from 'vitest';
import {
  buildSessionPartitionKey,
  buildUserAccountPartitionKey,
  getMetaSortKey,
  normalizeUsername,
} from './dynamo-auth-keys.js';

describe('dynamoAuthKeys', () => {
  it('normalizes usernames for partition keys', () => {
    expect(normalizeUsername({ rawUsername: '  Admin  ' })).toBe('admin');
  });

  it('builds stable PK/SK helpers', () => {
    expect(buildUserAccountPartitionKey({ usernameNormalized: 'admin' })).toBe('USER_ACCOUNT#admin');
    expect(buildSessionPartitionKey({ sessionId: 'sid' })).toBe('SESSION#sid');
    expect(getMetaSortKey()).toBe('META');
  });
});
