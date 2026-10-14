// The one module that defines endpoint calls (WEB-04). UI code calls `api.<area>.<verb>()` and never imports lib/http,
// fetch or XMLHttpRequest (ESLint enforces it); this file is the HTTP client's only consumer.
//
// Conventions for every later phase (guide: docs/web/api.md):
// - One group per area (`api.auth`, `api.orders`, `api.expenses`, `api.users`, `api.site`, `api.analytics`,
//   `api.profile`, `api.inquiries`). Every group is declared now; a group gains calls as its endpoints are built.
// - Request and response types come from the generated OpenAPI types (`components['schemas']`, D-16), never from
//   hand-written DTOs. Refresh them with tools/openapi-gen (docs/web/api.md, "The drift chain").
// - Every read takes an optional AbortSignal (TanStack Query passes its own) and hands it to the client.
// - Every POST function takes `{ idempotencyKey }` from useSubmission and passes it to the client, so retries and the
//   401 refresh retry resend the same key (WEB-09). The client never creates one.
// - All calls share one client, so concurrent 401s share one session refresh (WEB-03 single flight).
import type { components } from '@/types/api.generated';
import * as http from './http/httpClient';

export { HttpError, isHttpError, type HttpErrorKind } from './http/HttpError';

type Schemas = components['schemas'];

/** The site settings (`GET /api/v1/site-settings`, Staff). */
export type SiteSettings = Schemas['SiteSettingsDto'];

/** A declared area group whose endpoints arrive in a later phase. */
type PlannedGroup = Readonly<Record<string, never>>;

export interface Api {
  /** Sign-in, refresh and sign-out (Phase 4). */
  readonly auth: PlannedGroup;
  readonly orders: PlannedGroup;
  readonly expenses: PlannedGroup;
  readonly users: PlannedGroup;
  readonly site: {
    /** `GET /api/v1/site-settings`. */
    readonly settings: (signal?: AbortSignal) => Promise<SiteSettings>;
  };
  readonly analytics: PlannedGroup;
  readonly profile: PlannedGroup;
  readonly inquiries: PlannedGroup;
}

/** Builds the endpoint functions over a client. Tests pass a client with a fake fetch. */
export function createApi(client: http.HttpClient): Api {
  return {
    auth: {},
    orders: {},
    expenses: {},
    users: {},
    site: {
      settings: (signal) => client.get<SiteSettings>('/site-settings', { signal }),
    },
    analytics: {},
    profile: {},
    inquiries: {},
  };
}

/** The app's API, same-origin under /api/v1. Phase 4 adds the session refresh and the sign-out on 401. */
export const api: Api = createApi(http.createHttpClient({ baseURL: '/api/v1' }));
