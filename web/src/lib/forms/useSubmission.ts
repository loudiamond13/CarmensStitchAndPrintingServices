// RED placeholder (02-16 Task 1): the final types with an inert body that never sends.

/** The server's validation messages per field, keyed in the server's casing (for example `Amount`). */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export type SubmissionOutcome<TResult> =
  { readonly ok: true; readonly value: TResult } | { readonly ok: false; readonly error: unknown };

export interface SubmissionOptions<TData, TResult> {
  readonly onSuccess?: (result: TResult, data: TData) => void;
  readonly onFailure?: (error: unknown) => void;
}

/** `submit()` may leave the data out when the submission carries none (a confirm button). */
export type SubmitArgs<TData> = undefined extends TData ? [data?: TData] : [data: TData];

export interface SubmissionState<TData, TResult> {
  readonly submit: (...args: SubmitArgs<TData>) => Promise<SubmissionOutcome<TResult>>;
  readonly pending: boolean;
  readonly error: unknown;
  readonly fieldErrors: FieldErrors;
  readonly reset: () => void;
}

export function useSubmission<TData, TResult>(
  send: (key: string, data: TData) => Promise<TResult>,
  options?: SubmissionOptions<TData, TResult>,
): SubmissionState<TData, TResult> {
  return {
    // Inert: reports the inputs as a failure without calling send.
    submit: () => Promise.resolve({ ok: false, error: [send, options] }),
    pending: false,
    error: undefined,
    fieldErrors: {},
    reset: () => undefined,
  };
}
