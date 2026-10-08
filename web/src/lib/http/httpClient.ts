// The project's only HTTP transport (WEB-03, PRD 9.3): an axios-like client over fetch. src/lib/api.ts is its only
// consumer (WEB-04, enforced by ESLint). Every failure rejects with an HttpError; a raw Response never escapes.
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
  readonly timeoutMs?: number | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly onUploadProgress?: ((progress: UploadProgress) => void) | undefined;
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
  };
}

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpClientConfig {
  /** Prefix for every request path, for example '/api/v1'. */
  readonly baseURL?: string | undefined;
  /** Injected in tests; defaults to the global fetch. */
  readonly fetch?: FetchFunction | undefined;
  /** Headers sent with every request. Request headers override them. */
  readonly headers?: Readonly<Record<string, string>> | undefined;
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

/** Turns a received status, headers and body text into the response data, or throws an HttpError. */
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
  if (!json) {
    return { status, headers, data: text };
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
  const requestInterceptors = createRegistry<RequestInterceptor>();

  function initialRequest(request: RequestConfig): HttpRequest {
    const headers = new Headers(config.headers);
    headers.set('Accept', 'application/json');
    for (const [name, value] of Object.entries(request.headers ?? {})) {
      headers.set(name, value);
    }
    return {
      method: request.method ?? 'GET',
      url: request.url,
      params: request.params,
      headers,
      body: request.body,
    };
  }

  async function intercept(request: HttpRequest): Promise<HttpRequest> {
    let current = request;
    for (const interceptor of requestInterceptors.entries()) {
      current = await interceptor(current);
    }
    return current;
  }

  function encodeBody(request: HttpRequest): BodyInit | undefined {
    if (request.body === undefined || request.body instanceof FormData) {
      return request.body;
    }
    if (!request.headers.has('Content-Type')) {
      request.headers.set('Content-Type', 'application/json');
    }
    return JSON.stringify(request.body);
  }

  async function send(requestConfig: RequestConfig): Promise<HttpResponse> {
    const prepared = await intercept(initialRequest(requestConfig));
    const url = buildUrl(baseURL, prepared);
    const body = encodeBody(prepared);
    try {
      const response = await fetchImpl(url, {
        method: prepared.method,
        headers: prepared.headers,
        body: body ?? null,
        credentials: 'same-origin',
      });
      const text = await response.text();
      return toHttpResponse(response.status, response.headers, text);
    } catch (error) {
      if (isHttpError(error)) {
        throw error;
      }
      throw new HttpError({ kind: 'network', cause: error });
    }
  }

  async function request<T>(requestConfig: RequestConfig): Promise<T> {
    const response = await send(requestConfig);
    return response.data as T;
  }

  return {
    request,
    get: (url, options) => request({ ...options, method: 'GET', url }),
    delete: (url, options) => request({ ...options, method: 'DELETE', url }),
    post: (url, body, options) => request({ ...options, method: 'POST', url, body }),
    put: (url, body, options) => request({ ...options, method: 'PUT', url, body }),
    patch: (url, body, options) => request({ ...options, method: 'PATCH', url, body }),
    interceptors: { request: { use: requestInterceptors.use } },
  };
}
