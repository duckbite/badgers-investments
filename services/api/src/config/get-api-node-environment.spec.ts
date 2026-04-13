import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiNodeEnvironment, isApiProductionEnvironment } from './get-api-node-environment.js';

describe('getApiNodeEnvironment', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('API_NODE_ENV', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to development when both env vars are unset', () => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(process.env, 'NODE_ENV');
    Reflect.deleteProperty(process.env, 'API_NODE_ENV');
    expect(getApiNodeEnvironment()).toBe('development');
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('uses API_NODE_ENV over NODE_ENV', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_NODE_ENV', 'development');
    expect(getApiNodeEnvironment()).toBe('development');
    expect(isApiProductionEnvironment()).toBe(false);
  });

  it('treats production API_NODE_ENV as production regardless of NODE_ENV', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('API_NODE_ENV', 'production');
    expect(isApiProductionEnvironment()).toBe(true);
  });
});
