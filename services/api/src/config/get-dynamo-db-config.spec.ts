import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDynamoDbConfig } from './get-dynamo-db-config.js';

describe('getDynamoDbConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when API_DYNAMODB_TABLE_NAME is unset', () => {
    delete process.env['API_DYNAMODB_TABLE_NAME'];
    expect(() => getDynamoDbConfig()).toThrowError(/API_DYNAMODB_TABLE_NAME/);
  });

  it('returns config when table name and API_DYNAMODB_REGION are set', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-dev');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    const actual = getDynamoDbConfig();
    expect(actual).toEqual({
      tableName: 'badgers-dev',
      region: 'eu-west-1',
      endpoint: undefined,
    });
  });

  it('uses AWS_REGION when API_DYNAMODB_REGION is unset', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-dev');
    vi.stubEnv('API_DYNAMODB_REGION', '');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('AWS_DEFAULT_REGION', '');
    const actual = getDynamoDbConfig();
    expect(actual.region).toBe('us-east-1');
  });

  it('includes optional endpoint', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-dev');
    vi.stubEnv('API_DYNAMODB_REGION', 'eu-west-1');
    vi.stubEnv('API_DYNAMODB_ENDPOINT', 'http://localhost:4566');
    const actual = getDynamoDbConfig();
    expect(actual.endpoint).toBe('http://localhost:4566');
  });

  it('throws when table name is set but region is missing', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-dev');
    vi.stubEnv('API_DYNAMODB_REGION', '');
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('AWS_DEFAULT_REGION', '');
    expect(() => getDynamoDbConfig()).toThrowError(/region/);
  });
});
