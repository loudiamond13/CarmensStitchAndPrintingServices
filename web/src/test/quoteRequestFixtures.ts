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

/** Answers GET /api/v1/quote-requests/new-count with `count`, or with a problem of that status. The setup gives every test 0. */
export function newQuoteCountHandler(count: number | { readonly failWith: number } = 0) {
  return http.get('*/api/v1/quote-requests/new-count', () =>
    typeof count === 'number' ? HttpResponse.json({ count }) : quoteProblem(count.failWith),
  );
}

/** A problem+json answer with a status, and optionally its machine code and server sentence. */
export function quoteProblem(status: number, extra: { code?: string; detail?: string } = {}): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export type QuoteRequestDetailFixture = Schemas['QuoteRequestDetailResponse'];
export type QuoteRequestPhotoFixture = Schemas['QuoteRequestPhotoResponse'];
export type QuoteStatusChangedFixture = Schemas['QuoteRequestStatusChangedResponse'];

/** A made-up staff member who changed a request. */
export const MARIA = { id: '00000000-0000-4000-8000-0000000000a1', name: 'Maria Santos', formerStaff: false } as const;

/** A stored photo at `slot` with fake delivery addresses. */
export function quoteRequestPhoto(slot: number, fileName = `photo-${String(slot + 1)}.jpg`): QuoteRequestPhotoFixture {
  const base = `https://images.example.test/quote/${String(slot)}`;
  return {
    slot,
    fileName,
    width: 4000,
    height: 3000,
    thumb: { src: `${base}/thumb.jpg`, srcSet: `${base}/thumb.jpg 1x, ${base}/thumb-2x.jpg 2x` },
    viewer: { src: `${base}/viewer.jpg`, srcSet: `${base}/v640.jpg 640w, ${base}/v960.jpg 960w` },
    fullSize: `${base}/full-2000.jpg`,
  };
}

/** One request in full: Juan Dela Cruz, a New request received Nov 21, 2026 at 3:42 PM Manila time, with 3 stored photos. */
export function quoteRequestDetail(
  id: string = quoteRequestId(1),
  overrides: Partial<QuoteRequestDetailFixture> = {},
): QuoteRequestDetailFixture {
  return {
    id,
    receivedAtUtc: '2026-11-21T07:42:00Z',
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 555 0101',
    email: 'juan@example.test',
    product: { choice: 'line', title: 'Basketball Jerseys' },
    quantity: '21-50',
    message: 'Twelve jerseys, numbers 1 to 12.',
    status: 'new',
    statusChangedAtUtc: '2026-11-21T07:42:00Z',
    photoCount: 3,
    photos: [quoteRequestPhoto(0, 'front.jpg'), quoteRequestPhoto(1, 'back.jpg'), quoteRequestPhoto(2, 'logo.jpg')],
    missingPhotos: [],
    photosRemovedAtUtc: null,
    history: [{ from: null, to: 'new', changedBy: null, changedAt: '2026-11-21T07:42:00Z' }],
    notes: [],
    lastChangedBy: null,
    lastChangedAt: null,
    version: 'AAAAAAAAB9E=',
    orderId: null,
    orderNumber: null,
    ...overrides,
  };
}

/** What the fake detail API recorded. */
export interface QuoteRequestDetailBackend {
  /** The id of every GET /quote-requests/{id}. */
  reads: string[];
  /** Every POST /quote-requests/{id}/status: the id, the body and the Idempotency-Key. */
  moves: { id: string; body: { status: string; version: string }; key: string | null }[];
}

export type QuoteDetailResult = QuoteRequestDetailFixture | Response | Promise<QuoteRequestDetailFixture | Response>;
export type QuoteMoveResult = QuoteStatusChangedFixture | Response | Promise<QuoteStatusChangedFixture | Response>;

const DETAIL_PATH = /\/api\/v1\/quote-requests\/([0-9a-f-]{36})$/;
const STATUS_PATH = /\/api\/v1\/quote-requests\/([0-9a-f-]{36})\/status$/;

function isMoveBody(value: unknown): value is { status: string; version: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'string' &&
    'version' in value &&
    typeof value.version === 'string'
  );
}

/**
 * Answers GET /api/v1/quote-requests/{id} with a request, or with a function of the read number (from 1); and
 * POST /api/v1/quote-requests/{id}/status with `move`, by default the new status with a new version.
 */
export function quoteRequestBackend(
  detail: QuoteRequestDetailFixture | ((read: number, id: string) => QuoteDetailResult),
  move?: (body: { status: string; version: string }, id: string) => QuoteMoveResult,
): QuoteRequestDetailBackend {
  const backend: QuoteRequestDetailBackend = { reads: [], moves: [] };
  server.use(
    http.get(DETAIL_PATH, async ({ request }) => {
      const id = DETAIL_PATH.exec(new URL(request.url).pathname)?.[1] ?? '';
      backend.reads.push(id);
      const body = typeof detail === 'function' ? await detail(backend.reads.length, id) : detail;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
    http.post(STATUS_PATH, async ({ request }) => {
      const id = STATUS_PATH.exec(new URL(request.url).pathname)?.[1] ?? '';
      const raw: unknown = await request.json();
      const body = isMoveBody(raw) ? raw : { status: '', version: '' };
      backend.moves.push({ id, body, key: request.headers.get('Idempotency-Key') });
      const answer =
        move === undefined
          ? { id, status: body.status, statusChangedAtUtc: '2026-11-21T08:05:00Z', version: 'AAAAAAAAB9I=' }
          : await move(body, id);
      return answer instanceof Response ? answer : HttpResponse.json(answer);
    }),
  );
  return backend;
}
