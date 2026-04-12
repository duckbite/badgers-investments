import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthConfig } from '../../config/get-auth-config.js';
import { AuthService } from './auth-service.js';
import { hashPassword } from './password-hash-service.js';
import type { UserAccountRepository } from './user-account-repository.js';
import type { UserSessionRepository } from './user-session-repository.js';

describe('AuthService', () => {
  const userAccountMocks = {
    findByUsername: vi.fn(),
    touchLastLoginAt: vi.fn(),
  };
  const userSessionMocks = {
    createSession: vi.fn(),
    findValidSession: vi.fn(),
    deleteSession: vi.fn(),
  };
  const userAccountRepository = userAccountMocks as unknown as UserAccountRepository;
  const userSessionRepository = userSessionMocks as unknown as UserSessionRepository;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unknown users', async () => {
    userAccountMocks.findByUsername.mockResolvedValue(undefined);
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const actual = await service.login({
      username: 'nope',
      password: 'x',
      now: new Date('2026-01-01T00:00:00.000Z'),
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(actual).toEqual({ outcome: 'invalid_credentials' });
  });

  it('rejects inactive accounts', async () => {
    userAccountMocks.findByUsername.mockResolvedValue({
      userId: 'u1',
      username: 'a',
      passwordHash: hashPassword('pw'),
      isActive: false,
    });
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const actual = await service.login({
      username: 'a',
      password: 'pw',
      now: new Date('2026-01-01T00:00:00.000Z'),
      ipAddress: undefined,
      userAgent: undefined,
    });
    expect(actual).toEqual({ outcome: 'invalid_credentials' });
  });

  it('rejects wrong passwords', async () => {
    userAccountMocks.findByUsername.mockResolvedValue({
      userId: 'u1',
      username: 'a',
      passwordHash: hashPassword('right'),
      isActive: true,
    });
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const actual = await service.login({
      username: 'a',
      password: 'wrong',
      now: new Date('2026-01-01T00:00:00.000Z'),
      ipAddress: undefined,
      userAgent: undefined,
    });
    expect(actual).toEqual({ outcome: 'invalid_credentials' });
  });

  it('creates a session on success and tolerates last-login failures', async () => {
    userAccountMocks.findByUsername.mockResolvedValue({
      userId: 'u1',
      username: 'a',
      passwordHash: hashPassword('ok'),
      isActive: true,
    });
    userAccountMocks.touchLastLoginAt.mockRejectedValue(new Error('ddb'));
    userSessionMocks.createSession.mockResolvedValue(undefined);
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const now = new Date('2026-01-01T00:00:00.000Z');
    const actual = await service.login({
      username: 'a',
      password: 'ok',
      now,
      ipAddress: '1.2.3.4',
      userAgent: 'ua',
    });
    expect(actual.outcome).toBe('ok');
    if (actual.outcome !== 'ok') {
      throw new Error('expected ok');
    }
    expect(actual.user).toEqual({ userId: 'u1', username: 'a' });
    expect(userSessionMocks.createSession).toHaveBeenCalledTimes(1);
  });

  it('logout ignores empty session ids', async () => {
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    await service.logout({ sessionId: undefined });
    expect(userSessionMocks.deleteSession).not.toHaveBeenCalled();
  });

  it('logout deletes session when id is present', async () => {
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    await service.logout({ sessionId: 'sid' });
    expect(userSessionMocks.deleteSession).toHaveBeenCalledWith({ sessionId: 'sid' });
  });

  it('getSession returns undefined when cookie missing', async () => {
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const actual = await service.getSession({ sessionId: undefined, now: new Date() });
    expect(actual).toBeUndefined();
  });

  it('getSession returns undefined when session record is missing', async () => {
    userSessionMocks.findValidSession.mockResolvedValue(undefined);
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const actual = await service.getSession({ sessionId: 'gone', now: new Date('2026-01-01T00:00:00.000Z') });
    expect(actual).toBeUndefined();
  });

  it('getSession returns user when session is valid', async () => {
    userSessionMocks.findValidSession.mockResolvedValue({
      sessionId: 's',
      userId: 'u1',
      username: 'a',
      createdAt: 't',
      expiresAt: '2099-01-01T00:00:00.000Z',
      isRevoked: false,
    });
    const authConfig = getAuthConfig();
    const service = new AuthService({ userAccountRepository, userSessionRepository, authConfig });
    const actual = await service.getSession({ sessionId: 's', now: new Date('2026-01-01T00:00:00.000Z') });
    expect(actual).toEqual({ userId: 'u1', username: 'a' });
  });
});
