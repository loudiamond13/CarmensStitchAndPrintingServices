// The shared MSW server for component and service tests. It starts with no handlers; each test adds its own with
// server.use, and setup.ts resets them after every test.
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const server = setupServer();

/** An MSW handler that answers POST /api/v1/analytics/page-views with `status` (204 by default). */
export function pageViewHandler(status = 204) {
  return http.post('*/api/v1/analytics/page-views', () => new HttpResponse(null, { status }));
}

export interface PageViewProbe {
  readonly requests: { body: unknown; csrf: string | null }[];
}

/** Answers page views with `status` and records each body and its anti-CSRF header. */
export function pageViewProbe(status = 204): PageViewProbe {
  const probe: PageViewProbe = { requests: [] };
  server.use(
    http.post('*/api/v1/analytics/page-views', async ({ request }) => {
      probe.requests.push({ body: await request.json(), csrf: request.headers.get('X-CSPS-CSRF') });
      return new HttpResponse(null, { status });
    }),
  );
  return probe;
}
