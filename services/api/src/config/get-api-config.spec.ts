import { describe, expect, it } from 'vitest';
import { getApiConfig } from './get-api-config.js';

function setEnvironmentVariable(input: { readonly key: string; readonly value: string }): void {
  process.env[input.key] = input.value;
}

function deleteEnvironmentVariable(input: { readonly key: string }): void {
  delete process.env[input.key];
}

describe('getApiConfig', () => {
  it('throws when API_DATABASE_URL is missing', () => {
    deleteEnvironmentVariable({ key: 'API_DATABASE_URL' });
    expect(() => getApiConfig()).toThrowError('Missing required environment variable: API_DATABASE_URL');
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

