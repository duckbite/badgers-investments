export type DynamoDbConfig = {
  readonly tableName: string;
  readonly region: string;
  readonly endpoint: string | undefined;
};

const API_DYNAMODB_TABLE_NAME_KEY: string = 'API_DYNAMODB_TABLE_NAME';
const API_DYNAMODB_REGION_KEY: string = 'API_DYNAMODB_REGION';
const API_DYNAMODB_ENDPOINT_KEY: string = 'API_DYNAMODB_ENDPOINT';
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

/**
 * Required DynamoDB settings from the root `.env` (loaded by dotenv-cli for the API process).
 */
export function getDynamoDbConfig(): DynamoDbConfig {
  const tableName: string | undefined = getTrimmedEnvironmentValue({ key: API_DYNAMODB_TABLE_NAME_KEY });
  if (tableName === undefined) {
    throw new Error(`Missing required environment variable: ${API_DYNAMODB_TABLE_NAME_KEY}`);
  }
  const regionFromApi: string | undefined = getTrimmedEnvironmentValue({ key: API_DYNAMODB_REGION_KEY });
  const regionFromAws: string | undefined = getTrimmedEnvironmentValue({ key: AWS_REGION_KEY });
  const regionFromDefault: string | undefined = getTrimmedEnvironmentValue({ key: AWS_DEFAULT_REGION_KEY });
  const region: string | undefined = regionFromApi ?? regionFromAws ?? regionFromDefault;
  if (region === undefined) {
    throw new Error(
      `Missing AWS region for DynamoDB: set ${API_DYNAMODB_REGION_KEY}, ${AWS_REGION_KEY}, or ${AWS_DEFAULT_REGION_KEY}`,
    );
  }
  const endpoint: string | undefined = getTrimmedEnvironmentValue({ key: API_DYNAMODB_ENDPOINT_KEY });
  return { tableName, region, endpoint };
}
