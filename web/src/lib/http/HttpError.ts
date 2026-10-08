// The one error type the HTTP client rejects with (WEB-03, PRD 9.3). INERT placeholder for the TDD RED step.

export type HttpErrorKind = 'network' | 'timeout' | 'aborted' | 'http' | 'parse';

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ProblemDetails {
  readonly type: string | undefined;
  readonly title: string | undefined;
  readonly status: number | undefined;
  readonly detail: string | undefined;
  readonly instance: string | undefined;
  readonly traceId: string | undefined;
  readonly errors: FieldErrors;
}

export interface HttpErrorInit {
  readonly kind: HttpErrorKind;
  readonly status?: number | undefined;
  readonly problem?: ProblemDetails | undefined;
  readonly cause?: unknown;
}

export class HttpError extends Error {
  readonly kind: HttpErrorKind = 'network';
  readonly status: number = -1;
  readonly problem: ProblemDetails | undefined = undefined;
  readonly fieldErrors: FieldErrors = {};
  readonly traceId: string | undefined = undefined;

  constructor(init: HttpErrorInit) {
    super('');
    this.cause = init.cause;
  }
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError && value.kind === 'parse';
}

export function parseProblemDetails(value: unknown): ProblemDetails | undefined {
  return typeof value === 'symbol' ? undefined : undefined;
}
