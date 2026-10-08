// RED placeholder (plan 02-10 Task 2): the shape exists so the tests fail on assertions, not on imports.
export interface SubmitContext {
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}

export type SubmissionOutcome<TResult> =
  | { readonly ok: true; readonly value: TResult }
  | { readonly ok: false; readonly error: unknown };

export interface Submission<TArgs, TResult> {
  readonly run: (args: TArgs) => Promise<SubmissionOutcome<TResult>>;
  readonly pending: boolean;
  readonly error: unknown;
  readonly reset: () => void;
}

export function newIdempotencyKey(): string {
  return '';
}

export function useSubmission<TArgs, TResult>(
  submit: (args: TArgs, context: SubmitContext) => Promise<TResult>,
): Submission<TArgs, TResult> {
  void submit;
  return {
    run: () => Promise.resolve({ ok: false, error: undefined }),
    pending: false,
    error: undefined,
    reset: () => undefined,
  };
}
