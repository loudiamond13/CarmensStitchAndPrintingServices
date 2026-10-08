// RED placeholder (plan 02-10 Task 1): the shape exists so the tests fail on assertions, not on imports.
import { createHttpClient, type HttpClient } from './http/httpClient';

export { HttpError, isHttpError, type HttpErrorKind } from './http/HttpError';

export type SiteSettings = Readonly<Record<string, string>>;

export interface Api {
  readonly site: {
    readonly settings: (signal?: AbortSignal) => Promise<SiteSettings>;
  };
}

export function createApi(client: HttpClient): Api {
  void client;
  return {
    site: {
      settings: () => Promise.resolve(undefined as unknown as SiteSettings),
    },
  };
}

export const api = createApi(createHttpClient({ baseURL: '/api/v1' }));
