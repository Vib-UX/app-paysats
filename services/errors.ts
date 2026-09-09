/**
 * Error carrying an HTTP-ish status so shared service functions can be reused
 * by both Next API route handlers and MCP tools (which surface it as text).
 */
export class ServiceError extends Error {
  readonly status: number;
  readonly errorKey?: string;

  constructor(
    status: number,
    message: string,
    opts?: { errorKey?: string },
  ) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.errorKey = opts?.errorKey;
  }
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ServiceError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export function errorKeyOf(e: unknown): string | undefined {
  if (e instanceof ServiceError && e.errorKey) return e.errorKey;
  return undefined;
}
