import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getApiConfig } from './get-api-config.js';

const ENVIRONMENT_KEYS = ['API_PORT', 'API_DATABASE_URL', 'DATABASE_URL'] as const;
type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number];
type EnvironmentSnapshot = Readonly<Record<EnvironmentKey, string | undefined>>;

function captureEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    API_PORT: process.env['API_PORT'],
    API_DATABASE_URL: process.env['API_DATABASE_URL'],
    DATABASE_URL: process.env['DATABASE_URL'],
  };
}

function restoreEnvironmentSnapshot(input: { readonly snapshot: EnvironmentSnapshot }): void {
  for (const key of ENVIRONMENT_KEYS) {
    const value: string | undefined = input.snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setEnvironmentVariable(input: { readonly key: string; readonly value: string }): void {
  process.env[input.key] = input.value;
}

function deleteEnvironmentVariable(input: { readonly key: string }): void {
  delete process.env[input.key];
}

describe('getApiConfig', () => {
  let snapshot: EnvironmentSnapshot;

  beforeEach(() => {
    snapshot = captureEnvironmentSnapshot();
  });

  afterEach(() => {
    restoreEnvironmentSnapshot({ snapshot });
  });

  it('throws when API_DATABASE_URL and DATABASE_URL are missing', () => {
    deleteEnvironmentVariable({ key: 'API_DATABASE_URL' });
    deleteEnvironmentVariable({ key: 'DATABASE_URL' });
    expect(() => getApiConfig()).toThrowError('Missing required environment variable: API_DATABASE_URL (or DATABASE_URL)');
  });

  it('uses DATABASE_URL when API_DATABASE_URL is missing', () => {
    deleteEnvironmentVariable({ key: 'API_DATABASE_URL' });
    setEnvironmentVariable({ key: 'DATABASE_URL', value: 'postgresql://fallback' });
    const actualConfig = getApiConfig();
    expect(actualConfig.databaseUrl).toBe('postgresql://fallback');
  });

  it('returns default port when API_PORT is missing', () => {
    deleteEnvironmentVariable({ key: 'API_PORT' });
    setEnvironmentVariable({ key: 'API_DATABASE_URL', value: 'postgresql://example' });
    const actualConfig = getApiConfig();
    expect(actualConfig.apiPort).toBe(3000);
    expect(actualConfig.databaseUrl).toBe('postgresql://example');
  });

  it('throws when API_PORT is not a positive number', () => {
    setEnvironmentVariable({ key: 'API_PORT', value: 'not-a-number' });
    setEnvironmentVariable({ key: 'API_DATABASE_URL', value: 'postgresql://example' });
    expect(() => getApiConfig()).toThrowError('Invalid environment variable API_PORT: expected a positive number');
  });

  it('returns configured values when env vars are valid', () => {
    setEnvironmentVariable({ key: 'API_PORT', value: '3100' });
    setEnvironmentVariable({ key: 'API_DATABASE_URL', value: 'postgresql://valid' });
    const actualConfig = getApiConfig();
    expect(actualConfig).toEqual({ apiPort: 3100, databaseUrl: 'postgresql://valid' });
  });
});

