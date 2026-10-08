// RED placeholder (plan 02-07 Task 1): the public shape only, with no behaviour yet.
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
  override readonly name = 'HttpError';
  readonly kind: HttpErrorKind;
  readonly status: number = -1;
  readonly problem: ProblemDetails | undefined = undefined;
  readonly fieldErrors: FieldErrors = { placeholder: [] };
  readonly traceId: string | undefined = undefined;

  constructor(init: HttpErrorInit) {
    super('');
    this.kind = init.kind;
  }
}

export function parseProblemDetails(value: unknown): ProblemDetails | undefined {
  void value;
  return undefined;
}

export function isHttpError(value: unknown): value is HttpError {
  void value;
  return false;
}
