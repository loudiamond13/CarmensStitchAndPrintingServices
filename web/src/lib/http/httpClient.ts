// The project's only HTTP transport (WEB-03, PRD 9.3). INERT placeholder for the TDD RED step: the types are final,
// the behaviour is not.
import type { HttpError } from './HttpError';

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

export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  const inert = <T>(): Promise<T> => Promise.resolve(config.baseURL === 'inert' ? (undefined as T) : (undefined as T));
  return {
    request: inert,
    get: inert,
    delete: inert,
    post: inert,
    put: inert,
    patch: inert,
    interceptors: {
      request: { use: () => () => undefined },
      response: { use: () => () => undefined },
    },
  };
}
