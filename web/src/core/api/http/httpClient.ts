// The project's only HTTP transport (WEB-03, PRD 9.3): an axios-like client over fetch. Only src/core/api imports it
// (WEB-04, enforced by ESLint). Every failure rejects with an HttpError; a raw Response never escapes.
import { HttpError, isHttpError, parseProblemDetails } from './HttpError';

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
export type ParamValue = string | number | boolean | null | undefined;
/** Query parameters. Arrays become repeated keys; null and undefined are skipped. */
export type Params = Readonly<Record<string, ParamValue | readonly ParamValue[]>>;

export interface UploadProgress {
  readonly loaded: number;
  /** Undefined when the browser cannot compute the total size. */
  readonly total: number | undefined;
}

export interface RequestConfig {
  /** Defaults to GET. */
  readonly method?: HttpMethod | undefined;
  /** Path below baseURL, for example '/site-settings'. */
  readonly url: string;
  readonly params?: Params | undefined;
  /** FormData is sent unchanged; any other defined value is sent as JSON. */
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly signal?: AbortSignal | undefined;
  /** Per-attempt time limit; overrides the client's. */
  readonly timeoutMs?: number | undefined;
  /**
   * Sent as the Idempotency-Key header on unsafe methods, and makes a POST retryable (WEB-09). It comes from the
   * caller, one per user submission; the client never creates one.
   */
  readonly idempotencyKey?: string | undefined;
  readonly onUploadProgress?: ((progress: UploadProgress) => void) | undefined;
  /**
   * A 401 on this request is its answer, not an ended session: it rejects untouched, with no session refresh, no retry
   * and no onUnauthorized. For sign-in, 2FA verify and the refresh call itself (LIB-WR-03).
   */
  readonly skipAuthRefresh?: boolean | undefined;
}

export type RequestOptions = Omit<RequestConfig, 'method' | 'url' | 'body'>;

/** What a request interceptor sees and returns. Interceptors may change the headers in place or return a copy. */
export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly params: Params | undefined;
  readonly headers: Headers;
  readonly body: unknown;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly data: unknown;
}

export type RequestInterceptor = (request: HttpRequest) => HttpRequest | Promise<HttpRequest>;
/** Runs on every successful response; may return a changed copy (for example, transformed data). */
export type ResponseInterceptor = (response: HttpResponse) => HttpResponse | Promise<HttpResponse>;
/** Sees every HttpError; the error it returns is the one the request rejects with. */
export type ErrorInterceptor = (error: HttpError) => HttpError | Promise<HttpError>;
/** Removes the interceptor it was returned for. Calling it again does nothing. */
export type Eject = () => void;

export interface HttpClient {
  request<T>(config: RequestConfig): Promise<T>;
  get<T>(url: string, options?: RequestOptions): Promise<T>;
  delete<T>(url: string, options?: RequestOptions): Promise<T>;
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  readonly interceptors: {
    readonly request: { use(interceptor: RequestInterceptor): Eject };
    readonly response: { use(onFulfilled?: ResponseInterceptor, onRejected?: ErrorInterceptor): Eject };
  };
}

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;
export type XhrFactory = () => XMLHttpRequest;

/** Waits `ms` milliseconds. Must reject when `signal` aborts. */
export type Sleep = (ms: number, signal: AbortSignal | undefined) => Promise<void>;

export interface RetryPolicy {
  /** Retries after the first attempt. Clamped to 0..2; 0 turns retries off. Defaults to 2. */
  readonly max?: number | undefined;
  /** The first backoff delay; each later one doubles, up to maxDelayMs. Defaults to 250 ms. */
  readonly baseDelayMs?: number | undefined;
  /** Defaults to 2 seconds. */
  readonly maxDelayMs?: number | undefined;
}

export interface HttpClientConfig {
  /** Prefix for every request path, for example '/api/v1'. */
  readonly baseURL?: string | undefined;
  /** Injected in tests; defaults to the global fetch. */
  readonly fetch?: FetchFunction | undefined;
  /** Used only for requests with onUploadProgress. Injected in tests; defaults to `new XMLHttpRequest()`. */
  readonly xhrFactory?: XhrFactory | undefined;
  /** Headers sent with every request. Request headers override them. */
  readonly headers?: Readonly<Record<string, string>> | undefined;
  /** Per-attempt time limit. Defaults to 30 seconds. */
  readonly timeoutMs?: number | undefined;
  readonly retry?: RetryPolicy | undefined;
  /** Waits out each retry backoff. Injected in tests; defaults to a setTimeout-based wait. */
  readonly sleep?: Sleep | undefined;
  /**
   * Renews the session after a 401. Concurrent 401s share one call (single flight), and each request then retries
   * once. A 401 from a request sent before the last successful refresh retries with the new session without another
   * refresh. A rejection means the session is over. If it calls this same client, it must pass
   * `skipAuthRefresh: true`, or a 401 on the refresh call would wait for its own refresh forever (LIB-WR-04).
   */
  readonly refresh?: (() => Promise<void>) | undefined;
  /** Called when a 401 cannot be recovered: no refresh, a failed refresh, or a 401 again after a refresh. */
  readonly onUnauthorized?: (() => void) | undefined;
}

const defaultTimeoutMs = 30_000;
const maxRetries = 2;
const defaultBaseDelayMs = 250;
const defaultMaxDelayMs = 2_000;

/**
 * Methods retried after a network error or 503. A POST joins them only when it carries an Idempotency-Key (WEB-09). A
 * keyed request whose body is FormData is never retried (LIB-CR-02).
 */
const retryableMethods: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);
/** Safe methods never carry an Idempotency-Key header. */
const safeMethods: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['GET', 'HEAD', 'OPTIONS']);
/** Parameter names that would put a secret in a URL, where logs, history and Referer headers keep it (CWE-598). */
const secretParams: ReadonlySet<string> = new Set([
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'otp',
  'code',
]);

const defaultSleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The wait was cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

interface RefreshCycle {
  done: Promise<void>;
  unauthorizedNotified: boolean;
}

interface Registry<T> {
  readonly use: (entry: T) => Eject;
  readonly entries: () => readonly T[];
}

/** Keeps entries in registration order. */
function createRegistry<T>(): Registry<T> {
  const map = new Map<number, T>();
  let nextId = 0;
  return {
    use(entry) {
      const id = nextId++;
      map.set(id, entry);
      return () => {
        map.delete(id);
      };
    },
    entries: () => [...map.values()],
  };
}

function joinUrl(baseURL: string, path: string): string {
  return `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function serializeParams(params: Params | undefined): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    const values: readonly ParamValue[] = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== null && item !== undefined) {
        search.append(name, String(item));
      }
    }
  }
  return search.toString();
}

/**
 * Checks every parameter name: the `params` keys (even one whose value is skipped) and every name in the final URL's
 * query, so a query written into the path (`/auth/confirm?token=…`) cannot bypass the rule (LIB-WR-08).
 */
function assertNoSecretParams(params: Params | undefined, url: string): void {
  const queryNames = new URL(url, 'https://csps.invalid').searchParams.keys();
  for (const name of [...Object.keys(params ?? {}), ...queryNames]) {
    if (secretParams.has(name.toLowerCase())) {
      throw new TypeError(`The "${name}" parameter is not allowed: secrets never go in a URL. Send them in a header.`);
    }
  }
}

function buildUrl(baseURL: string, request: HttpRequest): string {
  const url = joinUrl(baseURL, request.url);
  const query = serializeParams(request.params);
  if (query === '') {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

const jsonContentType = /^application\/(?:problem\+)?json\s*(?:;|$)/i;

function isJson(headers: Headers): boolean {
  return jsonContentType.test(headers.get('Content-Type') ?? '');
}

function isUnauthorized(error: unknown): error is HttpError {
  return isHttpError(error) && error.status === 401;
}

/** Maps a transport failure to its kind by which signal fired: the caller's (aborted) or the time limit (timeout). */
function toTransportError(error: unknown, caller: AbortSignal | undefined, timeout: AbortSignal): HttpError {
  if (isHttpError(error)) {
    return error;
  }
  if (caller?.aborted === true) {
    return new HttpError({ kind: 'aborted', cause: error });
  }
  if (timeout.aborted) {
    return new HttpError({ kind: 'timeout', cause: error });
  }
  return new HttpError({ kind: 'network', cause: error });
}

interface RawResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
  /** True when the transport followed a redirect to reach this answer. */
  readonly redirected: boolean;
}

interface Outgoing {
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: Headers;
  readonly body: string | FormData | undefined;
  readonly signal: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException('The request was cancelled.', 'AbortError');
}

/** Parses getAllResponseHeaders(). A malformed line is skipped rather than failing the whole response. */
function parseResponseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      try {
        headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      } catch {
        // An invalid header name; ignore it.
      }
    }
  }
  return headers;
}

async function sendWithFetch(fetchImpl: FetchFunction, outgoing: Outgoing): Promise<RawResponse> {
  const response = await fetchImpl(outgoing.url, {
    method: outgoing.method,
    headers: outgoing.headers,
    body: outgoing.body ?? null,
    signal: outgoing.signal,
    credentials: 'same-origin',
  });
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
    redirected: response.redirected,
  };
}

/**
 * The XMLHttpRequest transport, used only when the caller asks for upload progress (fetch cannot report it). XHR sends
 * cookies only to its own origin by default (withCredentials stays false), matching the fetch transport.
 */
function sendWithXhr(
  createXhr: XhrFactory,
  outgoing: Outgoing,
  onUploadProgress: (progress: UploadProgress) => void,
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    if (outgoing.signal.aborted) {
      reject(abortError());
      return;
    }
    const xhr = createXhr();
    xhr.open(outgoing.method, outgoing.url);
    outgoing.headers.forEach((value, name) => {
      xhr.setRequestHeader(name, value);
    });
    xhr.upload.onprogress = (event) => {
      onUploadProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : undefined });
    };
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
        text: xhr.responseText,
        // responseURL is the final URL after redirects ('' when the browser does not report one).
        redirected: xhr.responseURL !== '' && xhr.responseURL !== new URL(outgoing.url, globalThis.location.href).href,
      });
    };
    xhr.onerror = () => {
      reject(new TypeError('The upload failed before the server answered.'));
    };
    xhr.onabort = () => {
      reject(abortError());
    };
    outgoing.signal.addEventListener(
      'abort',
      () => {
        xhr.abort();
      },
      { once: true },
    );
    xhr.send(outgoing.body ?? null);
  });
}

/**
 * Statuses that may carry no body: 204 and 205 by definition, and 202 ("accepted", like the forgot-password answer, which
 * says the same thing for every address). A HEAD answer never has one either. A 202 with a JSON body is still parsed.
 */
const noContentStatuses: ReadonlySet<number> = new Set([202, 204, 205]);

/** Turns a received answer into the response data, or throws an HttpError. */
function toHttpResponse(raw: RawResponse, method: HttpMethod): HttpResponse {
  const { status, headers, text } = raw;
  const json = isJson(headers);
  if (status < 200 || status > 299) {
    let problem;
    if (json) {
      try {
        problem = parseProblemDetails(JSON.parse(text));
      } catch {
        problem = undefined;
      }
    }
    throw new HttpError({ kind: 'http', status, problem });
  }
  if (text === '' && (noContentStatuses.has(status) || method === 'HEAD')) {
    return { status, headers, data: undefined };
  }
  // The API never redirects and answers with JSON or 204. A followed redirect, an empty body or a body of another type
  // is a captive portal, a proxy or a host page, never the DTO the caller typed (LIB-WR-05).
  if (raw.redirected || !json || text === '') {
    throw new HttpError({ kind: 'parse', status });
  }
  try {
    const data: unknown = JSON.parse(text);
    return { status, headers, data };
  } catch (cause) {
    throw new HttpError({ kind: 'parse', status, cause });
  }
}

export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  const baseURL = config.baseURL ?? '';
  const fetchImpl: FetchFunction = config.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const createXhr: XhrFactory = config.xhrFactory ?? (() => new XMLHttpRequest());
  const timeoutMs = config.timeoutMs ?? defaultTimeoutMs;
  const retryMax = Math.min(maxRetries, Math.max(0, config.retry?.max ?? maxRetries));
  const baseDelayMs = config.retry?.baseDelayMs ?? defaultBaseDelayMs;
  const maxDelayMs = config.retry?.maxDelayMs ?? defaultMaxDelayMs;
  const sleep = config.sleep ?? defaultSleep;
  const requestInterceptors = createRegistry<RequestInterceptor>();
  const responseInterceptors = createRegistry<{
    readonly onFulfilled: ResponseInterceptor | undefined;
    readonly onRejected: ErrorInterceptor | undefined;
  }>();
  let refreshCycle: RefreshCycle | undefined;
  /** The last refresh that succeeded. Each request notes it when sent (LIB-WR-04). */
  let lastRefreshed: RefreshCycle | undefined;

  function initialRequest(request: RequestConfig, method: HttpMethod): HttpRequest {
    const headers = new Headers(config.headers);
    headers.set('Accept', 'application/json');
    for (const [name, value] of Object.entries(request.headers ?? {})) {
      headers.set(name, value);
    }
    // Set before the interceptors run, from the caller's key only, so every attempt sends the same key (WEB-09).
    if (request.idempotencyKey !== undefined && !safeMethods.has(method)) {
      headers.set('Idempotency-Key', request.idempotencyKey);
    }
    return { method, url: request.url, params: request.params, headers, body: request.body };
  }

  async function intercept(request: HttpRequest): Promise<HttpRequest> {
    let current = request;
    for (const interceptor of requestInterceptors.entries()) {
      current = await interceptor(current);
    }
    return current;
  }

  function encodeBody(request: HttpRequest): string | FormData | undefined {
    if (request.body === undefined || request.body instanceof FormData) {
      return request.body;
    }
    if (!request.headers.has('Content-Type')) {
      request.headers.set('Content-Type', 'application/json');
    }
    return JSON.stringify(request.body);
  }

  /** One attempt. Request interceptors run on every attempt, so a refreshed token applies to the retry. */
  async function attempt(requestConfig: RequestConfig, method: HttpMethod): Promise<HttpResponse> {
    const prepared = await intercept(initialRequest(requestConfig, method));
    const url = buildUrl(baseURL, prepared);
    assertNoSecretParams(prepared.params, url);
    const body = encodeBody(prepared);
    const caller = requestConfig.signal;
    const timeout = new AbortController();
    const timer = setTimeout(() => {
      timeout.abort();
    }, requestConfig.timeoutMs ?? timeoutMs);
    const signal = AbortSignal.any(caller === undefined ? [timeout.signal] : [caller, timeout.signal]);
    const outgoing: Outgoing = { url, method: prepared.method, headers: prepared.headers, body, signal };
    const { onUploadProgress } = requestConfig;
    try {
      const raw =
        onUploadProgress === undefined
          ? await sendWithFetch(fetchImpl, outgoing)
          : await sendWithXhr(createXhr, outgoing, onUploadProgress);
      return toHttpResponse(raw, prepared.method);
    } catch (error) {
      throw toTransportError(error, caller, timeout.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  function canRetry(requestConfig: RequestConfig, method: HttpMethod, error: unknown): boolean {
    if (!isHttpError(error) || !(error.kind === 'network' || error.status === 503)) {
      return false;
    }
    // A multipart body gets a new boundary on every send, so a keyed retry would not be the same body and the server
    // would answer 422 (SEC-06). The user retries through useSubmission instead (LIB-CR-02).
    if (requestConfig.idempotencyKey !== undefined && requestConfig.body instanceof FormData) {
      return false;
    }
    return retryableMethods.has(method) || (method === 'POST' && requestConfig.idempotencyKey !== undefined);
  }

  /** At most `retryMax` retries with capped exponential backoff (PRD 9.3). TanStack Query does not retry on top. */
  async function sendWithRetries(requestConfig: RequestConfig, method: HttpMethod): Promise<HttpResponse> {
    for (let retry = 0; ; retry++) {
      try {
        return await attempt(requestConfig, method);
      } catch (error) {
        if (retry >= retryMax || !canRetry(requestConfig, method, error)) {
          throw error;
        }
        try {
          await sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** retry), requestConfig.signal);
        } catch (cause) {
          throw new HttpError({ kind: 'aborted', cause });
        }
      }
    }
  }

  function notifyUnauthorized(cycle: RefreshCycle): void {
    if (!cycle.unauthorizedNotified) {
      cycle.unauthorizedNotified = true;
      config.onUnauthorized?.();
    }
  }

  /**
   * Joins the refresh in flight, or starts one. The cycle is published before refresh() runs, so even a refresh that
   * throws synchronously is shared and then cleared.
   */
  function joinRefresh(refresh: () => Promise<void>): RefreshCycle {
    if (refreshCycle !== undefined) {
      return refreshCycle;
    }
    const cycle: RefreshCycle = { done: Promise.resolve(), unauthorizedNotified: false };
    refreshCycle = cycle;
    cycle.done = (async () => {
      try {
        await refresh();
        lastRefreshed = cycle;
      } catch (error) {
        notifyUnauthorized(cycle);
        throw error;
      } finally {
        refreshCycle = undefined;
      }
    })();
    return cycle;
  }

  async function execute(requestConfig: RequestConfig, method: HttpMethod): Promise<HttpResponse> {
    const sentAfter = lastRefreshed;
    try {
      return await sendWithRetries(requestConfig, method);
    } catch (error) {
      if (!isUnauthorized(error) || requestConfig.skipAuthRefresh === true) {
        throw error;
      }
      const { refresh } = config;
      if (refresh === undefined) {
        config.onUnauthorized?.();
        throw error;
      }
      const refreshed = lastRefreshed;
      let cycle: RefreshCycle;
      if (refreshed !== undefined && refreshed !== sentAfter) {
        // A refresh succeeded after this request was sent: its 401 is stale, so retry with the new session. Another
        // refresh could revoke the session where refresh tokens rotate with reuse detection (LIB-WR-04).
        cycle = refreshed;
      } else {
        cycle = joinRefresh(refresh);
        try {
          await cycle.done;
        } catch {
          throw error;
        }
      }
      // Retry once with the same config, so a POST resends its own Idempotency-Key (WEB-09).
      try {
        return await sendWithRetries(requestConfig, method);
      } catch (retryError) {
        if (isUnauthorized(retryError)) {
          notifyUnauthorized(cycle);
        }
        throw retryError;
      }
    }
  }

  /** Passes an HttpError through every onRejected interceptor. Anything else (a programming error) passes as is. */
  async function rejectThroughInterceptors(error: unknown): Promise<unknown> {
    if (!isHttpError(error)) {
      return error;
    }
    let current = error;
    for (const { onRejected } of responseInterceptors.entries()) {
      if (onRejected !== undefined) {
        current = await onRejected(current);
      }
    }
    return current;
  }

  async function request<T>(requestConfig: RequestConfig): Promise<T> {
    let response: HttpResponse;
    try {
      response = await execute(requestConfig, requestConfig.method ?? 'GET');
    } catch (error) {
      throw await rejectThroughInterceptors(error);
    }
    for (const { onFulfilled } of responseInterceptors.entries()) {
      if (onFulfilled !== undefined) {
        response = await onFulfilled(response);
      }
    }
    return response.data as T;
  }

  return {
    request,
    get: (url, options) => request({ ...options, method: 'GET', url }),
    delete: (url, options) => request({ ...options, method: 'DELETE', url }),
    post: (url, body, options) => request({ ...options, method: 'POST', url, body }),
    put: (url, body, options) => request({ ...options, method: 'PUT', url, body }),
    patch: (url, body, options) => request({ ...options, method: 'PATCH', url, body }),
    interceptors: {
      request: { use: requestInterceptors.use },
      response: { use: (onFulfilled, onRejected) => responseInterceptors.use({ onFulfilled, onRejected }) },
    },
  };
}
