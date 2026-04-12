import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthConfig } from './get-auth-config.js';

describe('getAuthConfig', () => {
  beforeEach(() => {
    vi.stubEnv('API_SESSION_COOKIE_NAME', '');
    vi.stubEnv('API_SESSION_TTL_SECONDS', '');
    vi.stubEnv('API_LOGIN_RATE_LIMIT_MAX', '');
    vi.stubEnv('API_LOGIN_RATE_LIMIT_WINDOW_MS', '');
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('API_NODE_ENV', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns defaults when optional env vars are unset', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'development');
    const actual = getAuthConfig();
    expect(actual.sessionCookieName).toBe('badgers_session');
    expect(actual.sessionTtlSeconds).toBe(60 * 60 * 24 * 7);
    expect(actual.isCookieSecure).toBe(false);
  });

  it('enables secure cookies in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAuthConfig().isCookieSecure).toBe(true);
  });

  it('uses API_NODE_ENV over NODE_ENV for cookie secure flag', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('API_NODE_ENV', 'production');
    expect(getAuthConfig().isCookieSecure).toBe(true);
  });

  it('honours custom cookie name and limits', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('API_SESSION_COOKIE_NAME', 'my_session');
    vi.stubEnv('API_LOGIN_RATE_LIMIT_MAX', '5');
    vi.stubEnv('API_LOGIN_RATE_LIMIT_WINDOW_MS', '10000');
    const actual = getAuthConfig();
    expect(actual.sessionCookieName).toBe('my_session');
    expect(actual.loginRateLimitMax).toBe(5);
    expect(actual.loginRateLimitWindowMilliseconds).toBe(10000);
  });

  it('throws on invalid numeric env', () => {
    vi.stubEnv('API_SESSION_TTL_SECONDS', 'nope');
    expect(() => getAuthConfig()).toThrow(/API_SESSION_TTL_SECONDS/);
  });

  it('treats missing NODE_ENV and API_NODE_ENV as development', () => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(process.env, 'NODE_ENV');
    Reflect.deleteProperty(process.env, 'API_NODE_ENV');
    expect(getAuthConfig().isCookieSecure).toBe(false);
    vi.stubEnv('NODE_ENV', 'test');
  });
});
