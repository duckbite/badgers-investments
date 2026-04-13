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
 * Effective API runtime mode: `API_NODE_ENV` when set, else `NODE_ENV`, else `development` (lowercase).
 * Matches session cookie `Secure` and other prod gating.
 */
export function getApiNodeEnvironment(): string {
  return (
    getTrimmedEnvironmentValue({ key: 'API_NODE_ENV' }) ??
    getTrimmedEnvironmentValue({ key: 'NODE_ENV' }) ??
    'development'
  ).toLowerCase();
}

export function isApiProductionEnvironment(): boolean {
  return getApiNodeEnvironment() === 'production';
}

/**
 * True when running inside AWS Lambda (API or worker). Used to skip OpenAPI/Swagger UI
 * in bundled handlers where @fastify/swagger-ui static assets are not available, even if
 * NODE_ENV is unset (Lambda default) and the app would otherwise look "non-production".
 */
export function isAwsLambdaExecutionEnvironment(): boolean {
  const fn: string | undefined = getTrimmedEnvironmentValue({ key: 'AWS_LAMBDA_FUNCTION_NAME' });
  return fn !== undefined;
}
