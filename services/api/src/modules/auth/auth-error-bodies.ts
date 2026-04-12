export function buildInvalidCredentialsErrorBody(input: { readonly requestId: string }): { readonly error: object } {
  return {
    error: {
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
      requestId: input.requestId,
    },
  };
}

export function buildAuthRequiredErrorBody(input: { readonly requestId: string }): { readonly error: object } {
  return {
    error: {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required.',
      requestId: input.requestId,
    },
  };
}
