// Inert placeholder (plan 02-15 RED): the final shape with no endpoint behind it.
import type { components } from '@/types/api.generated';
import { createHttpClient, type HttpClient } from './http/httpClient';

export { HttpError, isHttpError, type HttpErrorKind } from './http/HttpError';

type Schemas = components['schemas'];

export type SiteSettings = Schemas['SiteSettingsDto'];

type PlannedGroup = Readonly<Record<string, never>>;

export interface Api {
  readonly auth: PlannedGroup;
  readonly orders: PlannedGroup;
  readonly expenses: PlannedGroup;
  readonly users: PlannedGroup;
  readonly site: {
    readonly settings: (signal?: AbortSignal) => Promise<SiteSettings>;
  };
  readonly analytics: PlannedGroup;
  readonly profile: PlannedGroup;
  readonly inquiries: PlannedGroup;
}

export function createApi(client: HttpClient): Api {
  void client;
  return {
    auth: {},
    orders: {},
    expenses: {},
    users: {},
    site: { settings: () => Promise.reject(new Error('not implemented')) },
    analytics: {},
    profile: {},
    inquiries: {},
  };
}

export const api: Api = createApi(createHttpClient({ baseURL: '/' }));
