const USER_ACCOUNT_PREFIX: string = 'USER_ACCOUNT#';
const SESSION_PREFIX: string = 'SESSION#';
const META_SORT_KEY: string = 'META';

export function buildUserAccountPartitionKey(input: { readonly usernameNormalized: string }): string {
  return `${USER_ACCOUNT_PREFIX}${input.usernameNormalized}`;
}

export function buildSessionPartitionKey(input: { readonly sessionId: string }): string {
  return `${SESSION_PREFIX}${input.sessionId}`;
}

export function getMetaSortKey(): string {
  return META_SORT_KEY;
}

export function normalizeUsername(input: { readonly rawUsername: string }): string {
  return input.rawUsername.trim().toLowerCase();
}
