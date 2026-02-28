type ApiConfig = {
  readonly apiPort: number;
  readonly databaseUrl: string;
};

const DEFAULT_API_PORT: number = 3000;

function getRequiredEnvironmentVariable(input: { readonly key: string }): string {
  const value: string | undefined = process.env[input.key];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${input.key}`);
  }
  return value;
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
  const databaseUrl: string = getRequiredEnvironmentVariable({ key: 'API_DATABASE_URL' });
  return { apiPort, databaseUrl };
}

