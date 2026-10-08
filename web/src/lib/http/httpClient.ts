// RED placeholder (plan 02-07 Task 1): the public shape only, with no behaviour yet.
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
  readonly baseURL?: string | undefined;
  readonly fetch?: FetchFunction | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
}

export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  void config;
  const notYet = <T>(): Promise<T> => Promise.resolve(undefined as T);
  return {
    request: notYet,
    get: notYet,
    delete: notYet,
    post: notYet,
    put: notYet,
    patch: notYet,
    interceptors: { request: { use: () => () => undefined } },
  };
}
