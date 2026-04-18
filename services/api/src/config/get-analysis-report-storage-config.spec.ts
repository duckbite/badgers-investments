import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAnalysisReportStorageConfig } from './get-analysis-report-storage-config.js';

describe('getAnalysisReportStorageConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null bucket when API_REPORTS_S3_DISABLED is true', () => {
    vi.stubEnv('API_REPORTS_S3_DISABLED', 'true');
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-investments-dev');
    const actual = getAnalysisReportStorageConfig();
    expect(actual.bucketName).toBeNull();
  });

  it('uses explicit API_REPORTS_BUCKET_NAME when set', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-investments-dev');
    vi.stubEnv('API_REPORTS_BUCKET_NAME', 'my-custom-bucket');
    vi.stubEnv('API_DYNAMODB_REGION', 'us-east-1');
    const actual = getAnalysisReportStorageConfig();
    expect(actual.bucketName).toBe('my-custom-bucket');
    expect(actual.awsRegion).toBe('us-east-1');
  });

  it('derives bucket from API_DYNAMODB_TABLE_NAME when API_REPORTS_BUCKET_NAME is unset', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-investments-dev');
    vi.stubEnv('API_DYNAMODB_REGION', 'us-east-1');
    delete process.env['API_REPORTS_BUCKET_NAME'];
    const actual = getAnalysisReportStorageConfig();
    expect(actual.bucketName).toBe('badgers-investments-dev-analysis-reports');
    expect(actual.awsRegion).toBe('us-east-1');
  });

  it('prefers API_AWS_REGION over DynamoDB region for S3 client', () => {
    vi.stubEnv('API_DYNAMODB_TABLE_NAME', 'badgers-investments-dev');
    vi.stubEnv('API_DYNAMODB_REGION', 'us-east-1');
    vi.stubEnv('API_AWS_REGION', 'eu-west-1');
    const actual = getAnalysisReportStorageConfig();
    expect(actual.awsRegion).toBe('eu-west-1');
  });
});
