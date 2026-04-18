export type AnalysisReportStorageConfig = {
  readonly bucketName: string | null;
  readonly awsRegion: string;
};

const API_REPORTS_S3_DISABLED_KEY: string = 'API_REPORTS_S3_DISABLED';
const API_REPORTS_BUCKET_NAME_KEY: string = 'API_REPORTS_BUCKET_NAME';
const API_DYNAMODB_TABLE_NAME_KEY: string = 'API_DYNAMODB_TABLE_NAME';
const API_AWS_REGION_KEY: string = 'API_AWS_REGION';
const API_DYNAMODB_REGION_KEY: string = 'API_DYNAMODB_REGION';
const AWS_REGION_KEY: string = 'AWS_REGION';
const AWS_DEFAULT_REGION_KEY: string = 'AWS_DEFAULT_REGION';

function getTrimmedEnvironmentValue(input: { readonly key: string }): string | undefined {
  const rawValue: string | undefined = process.env[input.key];
  if (rawValue === undefined) {
    return undefined;
  }
  const trimmedValue: string = rawValue.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

function isAnalysisReportsS3ExplicitlyDisabled(): boolean {
  const raw: string | undefined = process.env[API_REPORTS_S3_DISABLED_KEY];
  if (raw === undefined) {
    return false;
  }
  const normalized: string = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/**
 * When `API_REPORTS_BUCKET_NAME` is unset, use `{API_DYNAMODB_TABLE_NAME}-analysis-reports`
 * so local dev matches Terraform (`badgers-investments-dev-analysis-reports`, etc.).
 */
function resolveAnalysisReportsBucketName(): string | undefined {
  const explicit: string | undefined = getTrimmedEnvironmentValue({ key: API_REPORTS_BUCKET_NAME_KEY });
  if (explicit !== undefined) {
    return explicit;
  }
  const tableName: string | undefined = getTrimmedEnvironmentValue({ key: API_DYNAMODB_TABLE_NAME_KEY });
  if (tableName === undefined) {
    return undefined;
  }
  return `${tableName}-analysis-reports`;
}

/**
 * Prefer explicit S3 region, then align with DynamoDB (bucket is co-provisioned in the same account/region).
 */
function resolveAwsRegionForAnalysisReportsS3(): string {
  const explicitS3: string | undefined = getTrimmedEnvironmentValue({ key: API_AWS_REGION_KEY });
  if (explicitS3 !== undefined) {
    return explicitS3;
  }
  const dynamoRegion: string | undefined = getTrimmedEnvironmentValue({ key: API_DYNAMODB_REGION_KEY });
  if (dynamoRegion !== undefined) {
    return dynamoRegion;
  }
  const awsRegion: string | undefined = getTrimmedEnvironmentValue({ key: AWS_REGION_KEY });
  if (awsRegion !== undefined) {
    return awsRegion;
  }
  const defaultRegion: string | undefined = getTrimmedEnvironmentValue({ key: AWS_DEFAULT_REGION_KEY });
  if (defaultRegion !== undefined) {
    return defaultRegion;
  }
  return 'eu-central-1';
}

/**
 * Resolves analysis report S3 settings. Bucket name: `API_REPORTS_BUCKET_NAME`, or
 * `{API_DYNAMODB_TABLE_NAME}-analysis-reports` when unset (Terraform naming). Set
 * `API_REPORTS_S3_DISABLED=true` to skip S3 entirely. Region follows `API_AWS_REGION`,
 * then `API_DYNAMODB_REGION`, then standard AWS region env vars.
 * All report PutObject/GetObject/presign paths must use this config — do not hardcode bucket names.
 */
export function getAnalysisReportStorageConfig(): AnalysisReportStorageConfig {
  if (isAnalysisReportsS3ExplicitlyDisabled()) {
    return { bucketName: null, awsRegion: resolveAwsRegionForAnalysisReportsS3() };
  }
  const bucketResolved: string | undefined = resolveAnalysisReportsBucketName();
  const bucketName: string | null = bucketResolved !== undefined ? bucketResolved : null;
  const awsRegion: string = resolveAwsRegionForAnalysisReportsS3();
  return { bucketName, awsRegion };
}
