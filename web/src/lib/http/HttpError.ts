// The one error type the HTTP client rejects with (WEB-03, PRD 9.3). Every failure, from a dropped connection to a
// ProblemDetails 409, becomes an HttpError, so callers never see a raw Response. The message is short plain English:
// the ProblemDetails title the server wrote (CspsProblemDetails, D-26/D-27), or a default for the kind. It never
// contains response text or a stack.

/**
 * What went wrong. `network`: no response (offline, DNS, CORS). `timeout`: the client's own time limit fired.
 * `aborted`: the caller cancelled. `http`: the server answered with a non-2xx status. `parse`: a 2xx body was not
 * valid JSON.
 */
export type HttpErrorKind = 'network' | 'timeout' | 'aborted' | 'http' | 'parse';

/** Validation messages keyed by field name, from the ProblemDetails `errors` member. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/** The RFC 9457 members CSPS uses, plus the `traceId` extension. Members with the wrong type are dropped. */
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
  /** The HTTP status. Leave it out (0) when there was no HTTP response. */
  readonly status?: number | undefined;
  readonly problem?: ProblemDetails | undefined;
  /** The underlying error, for debugging only. It never reaches the message. */
  readonly cause?: unknown;
}

const defaultMessages: Readonly<Record<HttpErrorKind, string>> = {
  network: "We couldn't reach the server. Check your connection and try again.",
  timeout: 'The server took too long to answer. Please try again.',
  aborted: 'The request was cancelled.',
  http: "The server couldn't complete the request.",
  parse: "The server sent a reply we couldn't read.",
};

const noFieldErrors: FieldErrors = Object.freeze({});

function messageFor(kind: HttpErrorKind, problem: ProblemDetails | undefined): string {
  const title = problem?.title?.trim();
  return title || defaultMessages[kind];
}

export class HttpError extends Error {
  override readonly name = 'HttpError';
  readonly kind: HttpErrorKind;
  /** The HTTP status, or 0 when there was no HTTP response. */
  readonly status: number;
  readonly problem: ProblemDetails | undefined;
  readonly fieldErrors: FieldErrors;
  readonly traceId: string | undefined;

  constructor(init: HttpErrorInit) {
    super(messageFor(init.kind, init.problem), { cause: init.cause });
    this.kind = init.kind;
    this.status = init.status ?? 0;
    this.problem = init.problem;
    this.fieldErrors = init.problem?.errors ?? noFieldErrors;
    this.traceId = init.problem?.traceId;
  }
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseFieldErrors(value: unknown): FieldErrors {
  if (!isRecord(value)) {
    return noFieldErrors;
  }
  const errors: Record<string, readonly string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      errors[field] = messages.filter((message): message is string => typeof message === 'string');
    }
  }
  return Object.freeze(errors);
}

/** Reads a parsed JSON body as ProblemDetails. Returns undefined when the body is not a JSON object. */
export function parseProblemDetails(value: unknown): ProblemDetails | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return Object.freeze({
    type: stringOrUndefined(value.type),
    title: stringOrUndefined(value.title),
    status: typeof value.status === 'number' ? value.status : undefined,
    detail: stringOrUndefined(value.detail),
    instance: stringOrUndefined(value.instance),
    traceId: stringOrUndefined(value.traceId),
    errors: parseFieldErrors(value.errors),
  });
}
