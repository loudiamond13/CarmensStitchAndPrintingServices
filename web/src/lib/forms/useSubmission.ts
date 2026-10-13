// One submission path for every form (WEB-09, SEC-06, T-02-43). A double-click, a second Enter or a retry must never
// create two orders, payments or expenses:
// - one Idempotency-Key per submission, created before the request and handed to `send`, which passes it to an api.ts
//   POST as `{ idempotencyKey }`; the HTTP client resends that key on its own retries and on the 401 refresh retry;
// - while a submission is pending, every further trigger gets the same in-flight promise, so one request is in flight;
// - a failed submission resubmitted with the same data (compared as JSON) is the same submission and keeps its key,
//   including one that carries no data (a fixed sentinel, L-25: JSON.stringify(undefined) is undefined), but only
//   when the failure leaves open whether the server saved it: no answer (network, timeout, cancelled), an unreadable
//   2xx, a 5xx, a 408 or a 409 (SEC-06 "still running"). A final 4xx (400, 401, 403, 404, 422, 429) is replayed by
//   SEC-06 for 24 hours, so the next submit after one gets a new key (LIB-WR-01);
// - only plain JSON data is compared (plain objects, arrays, strings, finite numbers, booleans, null). FormData, File,
//   Blob, Map, Set, Date, class instances, symbols, BigInts and cycles are never "the same submission", because
//   JSON.stringify turns many of them into "{}" and two different payloads would share a key (LIB-CR-02). Such a form
//   passes the `identity` option (for an upload: the file's name, size and lastModified, plus its other fields) to get
//   the retry and double-click protection back;
// - a succeeded submission triggered again with the same data (a double-click whose second click lands after a fast
//   response, LIB-CR-01) sends nothing: submit resolves with the same success outcome and onSuccess does not run again;
// - reset() or changed data starts a new submission with a new key. Call reset() when the form is ready for a new
//   entry (for example after clearing it), not inside onSuccess, or the double-click protection above is lost.
import { useRef, useState } from 'react';
import { isHttpError } from '@/lib/api';
import { describeHttpError, type ErrorCopy } from '@/lib/errors/describeHttpError';
import { newIdempotencyKey } from './idempotencyKey';

/** The server's validation messages per field, keyed in the server's casing (for example `Amount`). */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/** How one submission ended. `submit` resolves with it and never rejects, so a handler can `void submit(data)`. */
export type SubmissionOutcome<TResult> =
  { readonly ok: true; readonly value: TResult } | { readonly ok: false; readonly error: unknown };

export interface SubmissionOptions<TData, TResult> {
  /** Runs once per successful submission, after `pending` clears. */
  readonly onSuccess?: (result: TResult, data: TData) => void;
  /**
   * Runs once per failed submission, after `pending` clears, with the describeHttpError copy: show it in the danger
   * toast that stays until closed (D-04). For a 400 with field errors the copy is "Check the highlighted fields.":
   * show it as the form's banner (UI-SPEC), put the messages under the fields and focus the first with
   * focusFirstInvalid. Never drop it: when no rendered field matches a server key (focusFirstInvalid returns false),
   * the banner is the only feedback (LIB-WR-02). Not called when there is nothing to show (a 401, a cancelled request).
   */
  readonly onFailure?: (copy: ErrorCopy, error: unknown) => void;
  /**
   * Names a submission's data, for data that is not plain JSON (an upload's File or FormData). Two submits whose
   * identities are equal are the same submission. Without it, only plain JSON data is compared. A throw counts as
   * "cannot compare", so that submit gets a new key.
   */
  readonly identity?: (data: TData) => string;
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
  /** Forgets the last submission (its outcome, error, field errors and key), so the next submit is a new submission. */
  readonly reset: () => void;
}

/** Stands for "no data" when comparing a retry; JSON.stringify never returns it. */
const NO_DATA = '\u0000no-data';

const noFieldErrors: FieldErrors = Object.freeze({});

/**
 * True for data whose JSON text holds all of it: null, strings, booleans, finite numbers, and plain objects and arrays
 * of those (an undefined member is left out of the sent JSON as well). `ancestors` catches a cycle.
 */
function isPlainJson(value: unknown, ancestors: Set<object>): boolean {
  switch (typeof value) {
    case 'string':
    case 'boolean':
    case 'undefined':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      break;
    default:
      // A function, a symbol or a BigInt.
      return false;
  }
  if (value === null) {
    return true;
  }
  if (ancestors.has(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  const plain = Array.isArray(value) || prototype === Object.prototype || prototype === null;
  if (!plain || Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }
  ancestors.add(value);
  const members = Object.values(value).every((member) => isPlainJson(member, ancestors));
  ancestors.delete(value);
  return members;
}

/** Text for comparing a submission with the last one, or undefined when the data cannot be compared. */
function serialize<TData>(data: TData, identity: ((data: TData) => string) | undefined): string | undefined {
  try {
    if (identity !== undefined) {
      return identity(data);
    }
    if (data === undefined) {
      return NO_DATA;
    }
    return isPlainJson(data, new Set()) ? JSON.stringify(data) : undefined;
  } catch {
    // An identity option or a getter that throws: never the same submission, so the submit gets a new key.
    return undefined;
  }
}

/** True when the server may have run the failed request, so a retry must reuse its key to land on the stored result. */
function mayHaveRun(error: unknown): boolean {
  if (!isHttpError(error) || error.kind !== 'http') {
    return true;
  }
  return error.status >= 500 || error.status === 408 || error.status === 409;
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

/** The last settled submission, kept while the next trigger with the same data counts as the same submission. */
interface LastSubmission<TResult> {
  readonly key: string;
  readonly serialized: string;
  /** The outcome of a success, repeated for the same data; undefined after a failure that a retry may repeat. */
  readonly success: SubmissionOutcome<TResult> | undefined;
}

export function useSubmission<TData, TResult>(
  send: (key: string, data: TData) => Promise<TResult>,
  options?: SubmissionOptions<TData, TResult>,
): SubmissionState<TData, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(noFieldErrors);
  const inFlightRef = useRef<Promise<SubmissionOutcome<TResult>> | undefined>(undefined);
  const lastRef = useRef<LastSubmission<TResult> | undefined>(undefined);

  const run = async (data: TData, serialized: string | undefined, key: string): Promise<SubmissionOutcome<TResult>> => {
    lastRef.current = undefined;
    setPending(true);

    // Always settles asynchronously, after submit has stored the in-flight promise.
    const outcome = await attempt(() => send(key, data));

    inFlightRef.current = undefined;
    setPending(false);
    if (outcome.ok) {
      lastRef.current = serialized === undefined ? undefined : { key, serialized, success: outcome };
      setError(undefined);
      setFieldErrors(noFieldErrors);
      options?.onSuccess?.(outcome.value, data);
    } else {
      lastRef.current =
        serialized === undefined || !mayHaveRun(outcome.error) ? undefined : { key, serialized, success: undefined };
      const failedFields = fieldErrorsOf(outcome.error);
      setError(outcome.error);
      setFieldErrors(failedFields);
      const copy = describeHttpError(outcome.error);
      if (copy !== null) {
        options?.onFailure?.(copy, outcome.error);
      }
    }
    return outcome;
  };

  const submit = (...args: SubmitArgs<TData>): Promise<SubmissionOutcome<TResult>> => {
    const inFlight = inFlightRef.current;
    if (inFlight !== undefined) {
      return inFlight;
    }
    // SubmitArgs leaves the data out only when TData admits undefined.
    const data = args[0] as TData;
    const serialized = serialize(data, options?.identity);
    const last = lastRef.current;
    const same = last !== undefined && last.serialized === serialized;
    if (same && last.success !== undefined) {
      return Promise.resolve(last.success);
    }
    const started = run(data, serialized, same ? last.key : newIdempotencyKey());
    inFlightRef.current = started;
    return started;
  };

  const reset = (): void => {
    lastRef.current = undefined;
    setError(undefined);
    setFieldErrors(noFieldErrors);
  };

  return { submit, pending, error, fieldErrors, reset };
}
