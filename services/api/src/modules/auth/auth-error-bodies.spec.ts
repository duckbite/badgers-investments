import { describe, expect, it } from 'vitest';
import { buildAuthRequiredErrorBody, buildInvalidCredentialsErrorBody } from './auth-error-bodies.js';

describe('authErrorBodies', () => {
  it('builds invalid credential errors', () => {
    expect(buildInvalidCredentialsErrorBody({ requestId: 'r1' })).toEqual({
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
        requestId: 'r1',
      },
    });
  });

  it('builds auth required errors', () => {
    expect(buildAuthRequiredErrorBody({ requestId: 'r2' })).toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
        requestId: 'r2',
      },
    });
  });
});
