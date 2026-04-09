import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getApiConfig } from './get-api-config.js';

const ENVIRONMENT_KEYS = ['API_PORT'] as const;
type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number];
type EnvironmentSnapshot = Readonly<Record<EnvironmentKey, string | undefined>>;

function captureEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    API_PORT: process.env['API_PORT'],
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

  it('returns default port when API_PORT is missing', () => {
    deleteEnvironmentVariable({ key: 'API_PORT' });
    const actualConfig = getApiConfig();
    expect(actualConfig.apiPort).toBe(3000);
  });

  it('throws when API_PORT is not a positive number', () => {
    setEnvironmentVariable({ key: 'API_PORT', value: 'not-a-number' });
    expect(() => getApiConfig()).toThrowError('Invalid environment variable API_PORT: expected a positive number');
  });

  it('returns configured port when API_PORT is valid', () => {
    setEnvironmentVariable({ key: 'API_PORT', value: '3100' });
    const actualConfig = getApiConfig();
    expect(actualConfig).toEqual({ apiPort: 3100 });
  });
});
