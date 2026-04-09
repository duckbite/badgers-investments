type ApiConfig = {
  readonly apiPort: number;
};

const DEFAULT_API_PORT: number = 3000;

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
  return { apiPort };
}
