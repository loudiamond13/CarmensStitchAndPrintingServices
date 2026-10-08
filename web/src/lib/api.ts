// The one module that defines endpoint calls (WEB-04). UI code calls `api.<area>.<verb>()` and never imports lib/http,
// fetch or XMLHttpRequest (ESLint enforces it); this file is the HTTP client's only consumer.
//
// Conventions for every later phase:
// - One group per area (`api.auth`, `api.orders`, `api.expenses`, `api.users`, `api.site`, `api.analytics`,
//   `api.profile`, `api.inquiries`), added as its endpoints are built.
// - Request and response types come from the generated OpenAPI types (`components['schemas']`, D-16), never from
//   hand-written DTOs. Refresh them with tools/openapi-gen (docs/development.md, "API types").
// - Every read takes an optional AbortSignal (TanStack Query passes its own).
// - Every POST function takes `{ idempotencyKey }` from useSubmission and passes it to the client, so retries and the
//   401 refresh retry resend the same key (WEB-09). The client never creates one.
import type { components } from '@/types/api.generated';
import { createHttpClient, type HttpClient } from './http/httpClient';

export { HttpError, isHttpError, type HttpErrorKind } from './http/HttpError';

type Schemas = components['schemas'];

/** The site settings (`GET /api/v1/site-settings`, Staff). */
export type SiteSettings = Schemas['SiteSettingsDto'];

export interface Api {
  readonly site: {
    /** `GET /api/v1/site-settings`. */
    readonly settings: (signal?: AbortSignal) => Promise<SiteSettings>;
  };
}

/** Builds the endpoint functions over a client. Tests pass a client with a fake fetch. */
export function createApi(client: HttpClient): Api {
  return {
    site: {
      settings: (signal) => client.get<SiteSettings>('/site-settings', { signal }),
    },
  };
}

/** The app's API, same-origin under /api/v1. Phase 4 adds the session refresh and the sign-out on 401. */
export const api: Api = createApi(createHttpClient({ baseURL: '/api/v1' }));
