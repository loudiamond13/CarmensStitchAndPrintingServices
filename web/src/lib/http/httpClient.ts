// The project's only HTTP transport (WEB-03, PRD 9.3): an axios-like client over fetch. src/lib/api.ts is its only
// consumer (WEB-04, enforced by ESLint). Every failure rejects with an HttpError; a raw Response never escapes.
import { HttpError, isHttpError, parseProblemDetails } from './HttpError';

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
export type ParamValue = string | number | boolean | null | undefined;
export type Params = Readonly<Record<string, ParamValue | readonly ParamValue[]>>;

export interface UploadProgress {
  readonly loaded: number;
  readonly total: number | undefined;
}

export interface RequestConfig {
  readonly method?: HttpMethod | undefined;
  readonly url: string;
  readonly params?: Params | undefined;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly onUploadProgress?: ((progress: UploadProgress) => void) | undefined;
}

export type RequestOptions = Omit<RequestConfig, 'method' | 'url' | 'body'>;

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
export type ResponseInterceptor = (response: HttpResponse) => HttpResponse | Promise<HttpResponse>;
export type ErrorInterceptor = (error: HttpError) => HttpError | Promise<HttpError>;
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
export type Sleep = (ms: number, signal: AbortSignal | undefined) => Promise<void>;

export interface RetryPolicy {
  readonly max?: number | undefined;
  readonly baseDelayMs?: number | undefined;
  readonly maxDelayMs?: number | undefined;
}

export interface HttpClientConfig {
  readonly baseURL?: string | undefined;
  readonly fetch?: FetchFunction | undefined;
  readonly xhrFactory?: XhrFactory | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly retry?: RetryPolicy | undefined;
  readonly sleep?: Sleep | undefined;
  readonly refresh?: (() => Promise<void>) | undefined;
  readonly onUnauthorized?: (() => void) | undefined;
}

const defaultTimeoutMs = 30_000;
const maxRetries = 2;
const defaultBaseDelayMs = 250;
const defaultMaxDelayMs = 2_000;

/** Methods retried after a network error or 503. A POST joins them only when it carries an Idempotency-Key (WEB-09). */
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

const jsonContentType = /^application\/(?:problem\+)?json\s*(?:;|$)/i;

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

function assertNoSecretParams(params: Params | undefined): void {
  for (const name of Object.keys(params ?? {})) {
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

function toHttpResponse(status: number, headers: Headers, text: string): HttpResponse {
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
  if (text === '') {
    return { status, headers, data: undefined };
  }
  return { status, headers, data: json ? (JSON.parse(text) as unknown) : text };
}

export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  const baseURL = config.baseURL ?? '';
  const fetchImpl: FetchFunction = config.fetch ?? ((input, init) => globalThis.fetch(input, init));
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

  function encodeBody(request: HttpRequest): string | undefined {
    if (request.body === undefined) {
      return undefined;
    }
    request.headers.set('Content-Type', 'application/json');
    return JSON.stringify(request.body);
  }

  /** One attempt. Request interceptors run on every attempt, so a refreshed token applies to the retry. */
  async function attempt(requestConfig: RequestConfig, method: HttpMethod): Promise<HttpResponse> {
    const prepared = await intercept(initialRequest(requestConfig, method));
    assertNoSecretParams(prepared.params);
    const url = buildUrl(baseURL, prepared);
    const body = encodeBody(prepared);
    const caller = requestConfig.signal;
    const timeout = new AbortController();
    const timer = setTimeout(() => {
      timeout.abort();
    }, requestConfig.timeoutMs ?? timeoutMs);
    const signal = AbortSignal.any(caller === undefined ? [timeout.signal] : [caller, timeout.signal]);
    try {
      const response = await fetchImpl(url, {
        method: prepared.method,
        headers: prepared.headers,
        body: body ?? null,
        signal,
        credentials: 'same-origin',
      });
      return toHttpResponse(response.status, response.headers, await response.text());
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
    try {
      return await sendWithRetries(requestConfig, method);
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }
      const { refresh } = config;
      if (refresh === undefined) {
        config.onUnauthorized?.();
        throw error;
      }
      const cycle = joinRefresh(refresh);
      try {
        await cycle.done;
      } catch {
        throw error;
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

  async function request<T>(requestConfig: RequestConfig): Promise<T> {
    const response = await execute(requestConfig, requestConfig.method ?? 'GET');
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
