import { env } from '$env/dynamic/public';

export function getApiBaseUrl(): string {
  return env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
}

