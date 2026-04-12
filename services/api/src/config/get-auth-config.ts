export type AuthConfig = {
  readonly sessionCookieName: string;
  readonly sessionTtlSeconds: number;
  readonly loginRateLimitMax: number;
  readonly loginRateLimitWindowMilliseconds: number;
  readonly isCookieSecure: boolean;
};

const DEFAULT_SESSION_COOKIE_NAME: string = 'badgers_session';
const DEFAULT_SESSION_TTL_SECONDS: number = 60 * 60 * 24 * 7;
const DEFAULT_LOGIN_RATE_LIMIT_MAX: number = 20;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS: number = 60_000;

function getPositiveIntegerFromEnv(input: { readonly key: string; readonly defaultValue: number }): number {
  const raw: string | undefined = process.env[input.key];
  if (raw === undefined || raw.trim().length === 0) {
    return input.defaultValue;
  }
  const parsed: number = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid environment variable ${input.key}: expected a positive integer`);
  }
  return Math.floor(parsed);
}

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
 * Cookie session and login rate-limit settings (root `.env`).
 */
export function getAuthConfig(): AuthConfig {
  const sessionCookieName: string =
    getTrimmedEnvironmentValue({ key: 'API_SESSION_COOKIE_NAME' }) ?? DEFAULT_SESSION_COOKIE_NAME;
  const sessionTtlSeconds: number = getPositiveIntegerFromEnv({
    key: 'API_SESSION_TTL_SECONDS',
    defaultValue: DEFAULT_SESSION_TTL_SECONDS,
  });
  const loginRateLimitMax: number = getPositiveIntegerFromEnv({
    key: 'API_LOGIN_RATE_LIMIT_MAX',
    defaultValue: DEFAULT_LOGIN_RATE_LIMIT_MAX,
  });
  const loginRateLimitWindowMilliseconds: number = getPositiveIntegerFromEnv({
    key: 'API_LOGIN_RATE_LIMIT_WINDOW_MS',
    defaultValue: DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  });
  const nodeEnv: string = (
    getTrimmedEnvironmentValue({ key: 'API_NODE_ENV' }) ??
    getTrimmedEnvironmentValue({ key: 'NODE_ENV' }) ??
    'development'
  ).toLowerCase();
  const isCookieSecure: boolean = nodeEnv === 'production';
  return {
    sessionCookieName,
    sessionTtlSeconds,
    loginRateLimitMax,
    loginRateLimitWindowMilliseconds,
    isCookieSecure,
  };
}
