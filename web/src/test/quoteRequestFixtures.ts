// Quote request inbox fixtures (INQ-05, D-18): list rows, a list answer with pill counts, and an MSW backend for
// GET /api/v1/quote-requests that records each request URL. All names and numbers are made up.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type QuoteRequestItemFixture = Schemas['QuoteRequestListItem'];
export type QuoteRequestListFixture = Schemas['QuoteRequestListResponse'];
export type QuoteRequestCountsFixture = Schemas['QuoteRequestCountsResponse'];

/** A request id: the number fills the last block. */
export function quoteRequestId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** One inbox row: Juan Dela Cruz, received Nov 21, 2026 at 3:42 PM Manila time, a New request with 3 photos. */
export function quoteRequestItem(
  id: string = quoteRequestId(1),
  overrides: Partial<QuoteRequestItemFixture> = {},
): QuoteRequestItemFixture {
  return {
    id,
    receivedAtUtc: '2026-11-21T07:42:00Z',
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 555 0101',
    product: { choice: 'line', title: 'Basketball Jerseys' },
    quantity: '21-50',
    photoCount: 3,
    storedPhotoCount: 3,
    photosRemoved: false,
    status: 'new',
    ...overrides,
  };
}

export const QUOTE_COUNTS: QuoteRequestCountsFixture = { open: 4, converted: 12, closed: 3, spam: 1, all: 20 };

export function quoteRequestList(
  items: readonly QuoteRequestItemFixture[],
  overrides: Partial<QuoteRequestListFixture> = {},
): QuoteRequestListFixture {
  return { items: [...items], total: items.length, page: 1, size: 20, counts: QUOTE_COUNTS, ...overrides };
}

export type QuoteListResult = QuoteRequestListFixture | Response | Promise<QuoteRequestListFixture | Response>;

/** What the fake API recorded. */
export interface QuoteRequestsBackend {
  /** Every GET /quote-requests request URL. */
  lists: URL[];
}

/** Answers GET /api/v1/quote-requests with a list, or with a function of the request URL. */
export function quoteRequestsBackend(
  list: QuoteRequestListFixture | ((url: URL) => QuoteListResult),
): QuoteRequestsBackend {
  const backend: QuoteRequestsBackend = { lists: [] };
  server.use(
    http.get('*/api/v1/quote-requests', async ({ request }) => {
      const url = new URL(request.url);
      backend.lists.push(url);
      const body = typeof list === 'function' ? await list(url) : list;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return backend;
}

/** A problem+json answer with a status. */
export function quoteProblem(status: number): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
