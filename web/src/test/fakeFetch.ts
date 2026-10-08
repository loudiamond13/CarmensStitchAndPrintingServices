// Test doubles for the HTTP client (plan 02-07). Tests inject these instead of touching the network, so nothing in
// Vitest ever calls a real fetch (research Pitfall 14) and every branch of lib/http is reachable on purpose.

/** One planned answer from the fake fetch. */
export type PlannedResponse =
  | {
      readonly status?: number;
      readonly headers?: Readonly<Record<string, string>>;
      /** A string is sent as-is. Any other value is sent as JSON with Content-Type application/json. */
      readonly body?: unknown;
    }
  | { readonly networkError: true }
  | { readonly hang: true };

/** A planned answer, or a function that decides the answer when the call arrives. */
export type Plan = PlannedResponse | ((call: FakeCall) => PlannedResponse | Promise<PlannedResponse>);

/** What the fake fetch recorded about one call. */
export interface FakeCall {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
  readonly init: RequestInit;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface FakeFetch {
  readonly fetch: FetchLike;
  readonly calls: FakeCall[];
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function toResponse(planned: PlannedResponse, signal: AbortSignal | null | undefined): Promise<Response> {
  if ('networkError' in planned) {
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  if ('hang' in planned) {
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(abortError());
      });
    });
  }
  const status = planned.status ?? 200;
  const headers = new Headers(planned.headers);
  let body: string | null = null;
  if (typeof planned.body === 'string') {
    body = planned.body;
  } else if (planned.body !== undefined) {
    body = JSON.stringify(planned.body);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }
  return Promise.resolve(new Response(body, { status, headers }));
}

/**
 * Builds a fake fetch that answers calls from `plans` in order and records every call. A call after the plans run out
 * rejects, so an unexpected extra request shows up as a failing test.
 */
export function createFakeFetch(plans: readonly Plan[]): FakeFetch {
  const calls: FakeCall[] = [];
  const queue = [...plans];
  const fetch: FetchLike = async (input, init) => {
    const call: FakeCall = {
      url: input,
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: init.body,
      init,
    };
    calls.push(call);
    if (init.signal?.aborted === true) {
      throw abortError();
    }
    const next = queue.shift();
    if (next === undefined) {
      throw new Error(`fake fetch: no planned response for call ${String(calls.length)} (${call.method} ${input})`);
    }
    const planned = typeof next === 'function' ? await next(call) : next;
    return toResponse(planned, init.signal);
  };
  return { fetch, calls };
}

/** A promise with its resolve and reject exposed, for ordering concurrent calls in a test. */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: Error) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
