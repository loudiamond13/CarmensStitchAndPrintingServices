// One submission path for every form (WEB-09, SEC-06, T-02-43). A double-click, a second Enter or a retry must never
// create two orders, payments or expenses:
// - one Idempotency-Key per submission, created before the request and handed to `send`, which passes it to an api.ts
//   POST as `{ idempotencyKey }`; the HTTP client resends that key on its own retries and on the 401 refresh retry;
// - while a submission is pending, every further trigger gets the same in-flight promise, so one request is in flight;
// - a failed submission resubmitted with the same data (compared as JSON) is the same submission and keeps its key,
//   including one that carries no data (a fixed sentinel, L-25: JSON.stringify(undefined) is undefined);
// - a success, reset() or changed data starts a new submission with a new key.
import { useRef, useState } from 'react';
import { isHttpError } from '@/lib/api';
import { newIdempotencyKey } from './idempotencyKey';

/** The server's validation messages per field, keyed in the server's casing (for example `Amount`). */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/** How one submission ended. `submit` resolves with it and never rejects, so a handler can `void submit(data)`. */
export type SubmissionOutcome<TResult> =
  { readonly ok: true; readonly value: TResult } | { readonly ok: false; readonly error: unknown };

export interface SubmissionOptions<TData, TResult> {
  /** Runs once per successful submission, after `pending` clears. */
  readonly onSuccess?: (result: TResult, data: TData) => void;
  /** Runs once per failed submission, after `pending` clears. */
  readonly onFailure?: (error: unknown) => void;
}

/** `submit()` may leave the data out when the submission carries none (a confirm button such as Delete Order). */
export type SubmitArgs<TData> = undefined extends TData ? [data?: TData] : [data: TData];

export interface SubmissionState<TData, TResult> {
  /** Starts a submission, or returns the one in flight. */
  readonly submit: (...args: SubmitArgs<TData>) => Promise<SubmissionOutcome<TResult>>;
  /** True from submit until the submission settles: drives the Button `loading` state (WEB-09). */
  readonly pending: boolean;
  /** The last failure; a success or reset() clears it. */
  readonly error: unknown;
  /** The field messages of the last failure when it was a 400 with field errors; otherwise empty. */
  readonly fieldErrors: FieldErrors;
  /** Forgets the last failure, its field errors and its key, so the next submit is a new submission. */
  readonly reset: () => void;
}

/** Stands for "no data" when comparing a retry; JSON.stringify never returns it. */
const NO_DATA = '\u0000no-data';

const noFieldErrors: FieldErrors = Object.freeze({});

/** Text for comparing a retry with the failed attempt, or undefined when the data cannot be compared as JSON. */
function serialize(data: unknown): string | undefined {
  if (data === undefined) {
    return NO_DATA;
  }
  try {
    // Undefined at run time for a function or a symbol, although the TypeScript typing says string.
    return JSON.stringify(data);
  } catch {
    // A BigInt or a cycle: never the same submission, so a retry gets a new key.
    return undefined;
  }
}

function fieldErrorsOf(error: unknown): FieldErrors {
  if (isHttpError(error) && error.status === 400 && Object.keys(error.fieldErrors).length > 0) {
    return error.fieldErrors;
  }
  return noFieldErrors;
}

/** Turns the result of `sendOnce`, its rejection or a synchronous throw into an outcome. Never rejects. */
function attempt<TResult>(sendOnce: () => Promise<TResult>): Promise<SubmissionOutcome<TResult>> {
  try {
    return sendOnce().then(
      (value): SubmissionOutcome<TResult> => ({ ok: true, value }),
      (error: unknown): SubmissionOutcome<TResult> => ({ ok: false, error }),
    );
  } catch (error: unknown) {
    return Promise.resolve({ ok: false, error });
  }
}

interface FailedSubmission {
  readonly key: string;
  readonly serialized: string;
}

export function useSubmission<TData, TResult>(
  send: (key: string, data: TData) => Promise<TResult>,
  options?: SubmissionOptions<TData, TResult>,
): SubmissionState<TData, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(noFieldErrors);
  const inFlightRef = useRef<Promise<SubmissionOutcome<TResult>> | undefined>(undefined);
  const failedRef = useRef<FailedSubmission | undefined>(undefined);

  const run = async (data: TData): Promise<SubmissionOutcome<TResult>> => {
    const serialized = serialize(data);
    const failed = failedRef.current;
    const key = failed !== undefined && failed.serialized === serialized ? failed.key : newIdempotencyKey();
    failedRef.current = undefined;
    setPending(true);

    // Always settles asynchronously, after submit has stored the in-flight promise.
    const outcome = await attempt(() => send(key, data));

    inFlightRef.current = undefined;
    setPending(false);
    if (outcome.ok) {
      setError(undefined);
      setFieldErrors(noFieldErrors);
      options?.onSuccess?.(outcome.value, data);
    } else {
      failedRef.current = serialized === undefined ? undefined : { key, serialized };
      setError(outcome.error);
      setFieldErrors(fieldErrorsOf(outcome.error));
      options?.onFailure?.(outcome.error);
    }
    return outcome;
  };

  const submit = (...args: SubmitArgs<TData>): Promise<SubmissionOutcome<TResult>> => {
    const inFlight = inFlightRef.current;
    if (inFlight !== undefined) {
      return inFlight;
    }
    // SubmitArgs leaves the data out only when TData admits undefined.
    const started = run(args[0] as TData);
    inFlightRef.current = started;
    return started;
  };

  const reset = (): void => {
    failedRef.current = undefined;
    setError(undefined);
    setFieldErrors(noFieldErrors);
  };

  return { submit, pending, error, fieldErrors, reset };
}
