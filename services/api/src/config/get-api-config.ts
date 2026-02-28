type ApiConfig = {
  readonly apiPort: number;
  readonly databaseUrl: string;
};

const DEFAULT_API_PORT: number = 3000;
const API_DATABASE_URL_KEY: string = 'API_DATABASE_URL';
const DATABASE_URL_KEY: string = 'DATABASE_URL';

function getRequiredEnvironmentVariableWithFallback(input: { readonly primaryKey: string; readonly fallbackKey: string }): string {
  const primaryValue: string | undefined = process.env[input.primaryKey];
  if (primaryValue !== undefined && primaryValue.length > 0) {
    return primaryValue;
  }
  const fallbackValue: string | undefined = process.env[input.fallbackKey];
  if (fallbackValue !== undefined && fallbackValue.length > 0) {
    return fallbackValue;
  }
  throw new Error(`Missing required environment variable: ${input.primaryKey} (or ${input.fallbackKey})`);
}

function getNumberEnvironmentVariable(input: { readonly key: string; readonly defaultValue: number }): number {
  const value: string | undefined = process.env[input.key];
  if (value === undefined || value.length === 0) {
    return input.defaultValue;
  }
  const parsedValue: number = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid environment variable ${input.key}: expected a positive number`);
  }
  return parsedValue;
}

export function getApiConfig(): ApiConfig {
  const apiPort: number = getNumberEnvironmentVariable({ key: 'API_PORT', defaultValue: DEFAULT_API_PORT });
  const databaseUrl: string = getRequiredEnvironmentVariableWithFallback({
    primaryKey: API_DATABASE_URL_KEY,
    fallbackKey: DATABASE_URL_KEY,
  });
  return { apiPort, databaseUrl };
}

