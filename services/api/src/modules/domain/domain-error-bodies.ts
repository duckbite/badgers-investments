export function buildValidationErrorBody(input: {
  readonly requestId: string;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}): { readonly error: object } {
  return {
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
      ...(input.details === undefined ? {} : { details: input.details }),
    },
  };
}

export function buildNotFoundErrorBody(input: { readonly requestId: string; readonly message: string }): { readonly error: object } {
  return {
    error: {
      code: 'NOT_FOUND',
      message: input.message,
      requestId: input.requestId,
    },
  };
}
