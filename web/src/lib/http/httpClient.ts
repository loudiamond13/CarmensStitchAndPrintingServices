// The project's only HTTP transport (WEB-03, PRD 9.3): an axios-like client over fetch. src/lib/api.ts is its only
// consumer (WEB-04, enforced by ESLint). Every failure rejects with an HttpError; a raw Response never escapes.
import { HttpError, parseProblemDetails } from './HttpError';

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
  const requestInterceptors = createRegistry<RequestInterceptor>();
  const responseInterceptors = createRegistry<{
    readonly onFulfilled: ResponseInterceptor | undefined;
    readonly onRejected: ErrorInterceptor | undefined;
  }>();

  function initialRequest(request: RequestConfig, method: HttpMethod): HttpRequest {
    const headers = new Headers(config.headers);
    headers.set('Accept', 'application/json');
    for (const [name, value] of Object.entries(request.headers ?? {})) {
      headers.set(name, value);
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

  async function request<T>(requestConfig: RequestConfig): Promise<T> {
    const prepared = await intercept(initialRequest(requestConfig, requestConfig.method ?? 'GET'));
    const body = encodeBody(prepared);
    const response = await fetchImpl(buildUrl(baseURL, prepared), {
      method: prepared.method,
      headers: prepared.headers,
      body: body ?? null,
      credentials: 'same-origin',
    });
    const parsed = toHttpResponse(response.status, response.headers, await response.text());
    return parsed.data as T;
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
