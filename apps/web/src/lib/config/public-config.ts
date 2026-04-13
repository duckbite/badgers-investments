export function getApiBaseUrl(): string {
  const raw: string | undefined = import.meta.env.PUBLIC_API_BASE_URL?.trim();
  if (raw !== undefined && raw.length > 0) {
    return raw.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

