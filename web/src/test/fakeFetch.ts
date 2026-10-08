// Test doubles for the HTTP client (plan 02-10). Tests inject these instead of touching the network, so nothing in
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

/** One planned answer from a fake XMLHttpRequest. */
export interface PlannedXhr {
  /** The response status for a 'load' outcome. Defaults to 200. */
  readonly status?: number;
  /** The raw header block getAllResponseHeaders() returns, lines separated by CRLF. */
  readonly headers?: string;
  readonly body?: string;
  /** Upload progress events fired before the outcome. Leave total out for a size the browser cannot compute. */
  readonly progress?: readonly { readonly loaded: number; readonly total?: number }[];
  /** 'load' (default) fires onload, 'error' fires onerror, 'hang' fires nothing until abort(). */
  readonly outcome?: 'load' | 'error' | 'hang';
}

interface FakeProgressEvent {
  readonly loaded: number;
  readonly total: number;
  readonly lengthComputable: boolean;
}

/** The parts of XMLHttpRequest the HTTP client uses, with what it was given recorded for assertions. */
export class FakeXhr {
  method = '';
  url = '';
  readonly requestHeaders: Record<string, string> = {};
  body: unknown = undefined;
  sent = false;
  aborted = false;
  status = 0;
  responseText = '';
  readonly upload: { onprogress: ((event: FakeProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  readonly #plan: PlannedXhr;
  #done = false;

  constructor(plan: PlannedXhr) {
    this.#plan = plan;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.requestHeaders[name.toLowerCase()] = value;
  }

  getAllResponseHeaders(): string {
    return this.#plan.headers ?? '';
  }

  send(body: unknown): void {
    this.body = body;
    this.sent = true;
    void Promise.resolve().then(() => {
      this.#run();
    });
  }

  /** Like the real one: aborting a finished request fires nothing. */
  abort(): void {
    if (this.#done) {
      return;
    }
    this.#done = true;
    this.aborted = true;
    this.onabort?.();
  }

  #run(): void {
    if (this.#done) {
      return;
    }
    for (const step of this.#plan.progress ?? []) {
      this.upload.onprogress?.({
        loaded: step.loaded,
        total: step.total ?? 0,
        lengthComputable: step.total !== undefined,
      });
    }
    const outcome = this.#plan.outcome ?? 'load';
    if (outcome === 'hang') {
      return;
    }
    this.#done = true;
    if (outcome === 'error') {
      this.onerror?.();
      return;
    }
    this.status = this.#plan.status ?? 200;
    this.responseText = this.#plan.body ?? '';
    this.onload?.();
  }
}

export interface FakeXhrFactory {
  readonly factory: () => XMLHttpRequest;
  /** A constructor for stubbing the global XMLHttpRequest. Shares the plans and instances with `factory`. */
  readonly XhrClass: new () => FakeXhr;
  readonly instances: FakeXhr[];
}

/** Builds fake XMLHttpRequests that answer from `plans` in order. Creating one after the plans run out throws. */
export function createFakeXhrFactory(plans: readonly PlannedXhr[]): FakeXhrFactory {
  const queue = [...plans];
  const instances: FakeXhr[] = [];
  class QueuedXhr extends FakeXhr {
    constructor() {
      const plan = queue.shift();
      if (plan === undefined) {
        throw new Error(`fake XMLHttpRequest: no planned response for request ${String(instances.length + 1)}`);
      }
      super(plan);
      instances.push(this);
    }
  }
  return {
    factory: () => new QueuedXhr() as unknown as XMLHttpRequest,
    XhrClass: QueuedXhr,
    instances,
  };
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
