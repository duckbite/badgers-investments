import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiPinoLoggerOptions } from './build-api-pino-logger-options.js';

describe('buildApiPinoLoggerOptions', () => {
  beforeEach(() => {
    vi.stubEnv('API_LOG_LEVEL', '');
    vi.stubEnv('API_NODE_ENV', '');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses API_LOG_LEVEL when set', () => {
    vi.stubEnv('API_LOG_LEVEL', 'warn');
    const actual = buildApiPinoLoggerOptions();
    expect(actual.level).toBe('warn');
  });

  it('defaults to debug when not production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const actual = buildApiPinoLoggerOptions();
    expect(actual.level).toBe('debug');
  });

  it('defaults to info in production', () => {
    vi.stubEnv('API_NODE_ENV', 'production');
    const actual = buildApiPinoLoggerOptions();
    expect(actual.level).toBe('info');
  });

  it('includes service and environment in log base fields', () => {
    vi.stubEnv('API_NODE_ENV', 'staging');
    const actual = buildApiPinoLoggerOptions();
    expect(actual.base).toEqual({
      service: 'badgers-api',
      environment: 'staging',
    });
  });
});
