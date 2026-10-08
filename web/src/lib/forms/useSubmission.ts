// One Idempotency-Key per user submission (WEB-09, SEC-06, PRD 9.3). A double-click, an Enter repeat or an automatic
// retry must never create two orders, payments or expenses:
// - the key is minted before the first attempt and handed to `submit`, which passes it to an api.ts POST; the HTTP
//   client resends it on every retry and on the 401 refresh retry;
// - while a submission is pending, every further trigger gets the same in-flight promise (one request in flight);
// - a failed submission retried with unchanged (JSON-equal) data is the same submission and keeps its key;
// - success, reset() or changed data starts a new submission with a new key.
import { useEffect, useRef, useState } from 'react';

/** What `submit` receives besides the form data. */
export interface SubmitContext {
  /** Pass it to the api.ts POST function as `{ idempotencyKey }`. */
  readonly idempotencyKey: string;
  /** Aborts when the component unmounts. Pass it to the api.ts function. */
  readonly signal: AbortSignal;
}

/** How one run ended. `run` never rejects, so a form handler can `void run(values)` without an unhandled rejection. */
export type SubmissionOutcome<TResult> =
  { readonly ok: true; readonly value: TResult } | { readonly ok: false; readonly error: unknown };

export interface Submission<TArgs, TResult> {
  /** Starts a submission, or returns the one in flight. */
  readonly run: (args: TArgs) => Promise<SubmissionOutcome<TResult>>;
  /** True from the first trigger until the submission settles (drives the WEB-09 pending button). */
  readonly pending: boolean;
  /** The last failure, cleared by a success or reset(). Turn it into copy with describeHttpError. */
  readonly error: unknown;
  /** Forgets the last failure and its key, so the next run is a new submission. */
  readonly reset: () => void;
}

function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Returns a random RFC 4122 version 4 UUID. Uses crypto.randomUUID, which exists only in secure contexts (localhost
 * and HTTPS); over a plain-HTTP LAN address it builds one from crypto.getRandomValues instead (research Pitfall 15).
 * Never a non-cryptographic random source: a predictable key could be guessed (T-02-29).
 */
export function newIdempotencyKey(): string {
  const { crypto } = globalThis;
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const digits = Array.from(bytes, (byte, index) => {
    if (index === 6) {
      return hex((byte & 0x0f) | 0x40); // version 4
    }
    if (index === 8) {
      return hex((byte & 0x3f) | 0x80); // variant 10xx
    }
    return hex(byte);
  }).join('');
  return `${digits.slice(0, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}-${digits.slice(16, 20)}-${digits.slice(20)}`;
}

/**
 * Text for comparing a retry with the failed attempt: JSON, or 'undefined' for a run without data (a confirm button).
 * Undefined when the data cannot be compared (a BigInt, a cycle, a function), so such a retry always gets a new key.
 */
function serialize(value: unknown): string | undefined {
  if (value === undefined) {
    return 'undefined';
  }
  try {
    // Undefined at run time for a function or a symbol, although its TypeScript typing says string.
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

const notMounted: AbortSignal = AbortSignal.abort();

interface Attempt {
  readonly key: string;
  /** JSON of the data that failed under `key`; undefined while it is in flight or when it cannot be compared. */
  readonly failedArgs: string | undefined;
}

export function useSubmission<TArgs, TResult>(
  submit: (args: TArgs, context: SubmitContext) => Promise<TResult>,
): Submission<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const attemptRef = useRef<Attempt | undefined>(undefined);
  const inFlightRef = useRef<Promise<SubmissionOutcome<TResult>> | undefined>(undefined);
  // Aborted until the component mounts, and again once it unmounts.
  const lifetimeRef = useRef<AbortSignal>(notMounted);

  useEffect(() => {
    // One controller per mount (StrictMode mounts twice), aborted on unmount so an in-flight request stops.
    const lifetime = new AbortController();
    lifetimeRef.current = lifetime.signal;
    return () => {
      lifetime.abort();
    };
  }, []);

  const run = (args: TArgs): Promise<SubmissionOutcome<TResult>> => {
    const inFlight = inFlightRef.current;
    if (inFlight !== undefined) {
      return inFlight;
    }

    const serialized = serialize(args);
    const previous = attemptRef.current;
    const sameSubmission = previous?.failedArgs !== undefined && previous.failedArgs === serialized;
    const key = sameSubmission ? previous.key : newIdempotencyKey();
    attemptRef.current = { key, failedArgs: undefined };

    const signal = lifetimeRef.current;
    setPending(true);

    const settled = (async (): Promise<SubmissionOutcome<TResult>> => {
      try {
        const value = await submit(args, { idempotencyKey: key, signal });
        attemptRef.current = undefined;
        setError(undefined);
        return { ok: true, value };
      } catch (failure: unknown) {
        attemptRef.current = { key, failedArgs: serialized };
        setError(failure);
        return { ok: false, error: failure };
      } finally {
        inFlightRef.current = undefined;
        setPending(false);
      }
    })();
    inFlightRef.current = settled;
    return settled;
  };

  const reset = (): void => {
    attemptRef.current = undefined;
    setError(undefined);
  };

  return { run, pending, error, reset };
}
