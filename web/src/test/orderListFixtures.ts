// Fixtures for the three order lists on the Settings tabs (plan 08-08): typed lists per list, one entry detail, and MSW handlers for
// every call the tabs make, parameterized by the route segment. Fake names only.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { ActionCalls, CategoryWriteCalls } from '@/test/expenseFixtures';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type OrderListItemFixture = Schemas['OrderListItem'];
export type OrderListEntryDetailFixture = Schemas['OrderListEntryDetailResponse'];

export type OrderListRoute = 'product-types' | 'payment-methods' | 'order-expense-categories';

const PROBLEM = { 'Content-Type': 'application/problem+json' };

export function listItem(
  id: string,
  name: string,
  tone: string,
  overrides: Partial<OrderListItemFixture> = {},
): OrderListItemFixture {
  return { id, name, tone, status: 'active', isOthers: false, useCount: 0, ...overrides };
}

export const BASKETBALL_ID = '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0001';
export const CYCLING_ID = '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0002';
export const OLD_TYPE_ID = '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0003';

/** What GET /api/v1/product-types answers: A to Z, one used, one retired, one never used. */
export const PRODUCT_TYPES: readonly OrderListItemFixture[] = [
  listItem(BASKETBALL_ID, 'Basketball Jersey', 'accent', { useCount: 12 }),
  listItem(CYCLING_ID, 'Cycling Jersey', 'info'),
  listItem(OLD_TYPE_ID, 'Old Style Jersey', 'neutral', { status: 'retired', useCount: 2 }),
];

export const CASH_ID = '7a2b9e10-3c55-4a1d-8e7f-4c0d2e5a0001';
export const GCASH_ID = '7a2b9e10-3c55-4a1d-8e7f-4c0d2e5a0002';

export const PAYMENT_METHODS: readonly OrderListItemFixture[] = [
  listItem(CASH_ID, 'Cash', 'success', { useCount: 40 }),
  listItem(GCASH_ID, 'GCash', 'info'),
];

export const FABRIC_ID = '9c4e1d20-5b66-4c2e-a8b1-6d1e3f7a0001';
export const LABOR_ID = '9c4e1d20-5b66-4c2e-a8b1-6d1e3f7a0002';
export const ORDER_OTHERS_ID = '9c4e1d20-5b66-4c2e-a8b1-6d1e3f7a0009';

export const ORDER_EXPENSE_CATEGORIES: readonly OrderListItemFixture[] = [
  listItem(FABRIC_ID, 'Fabric', 'warning', { useCount: 6 }),
  listItem(LABOR_ID, 'Labor', 'mockup'),
  listItem(ORDER_OTHERS_ID, 'Others', 'neutral', { isOthers: true, useCount: 1 }),
];

/** One entry as GET /api/v1/{list}/{id} answers it. */
export function entryDetail(overrides: Partial<OrderListEntryDetailFixture> = {}): OrderListEntryDetailFixture {
  return {
    id: BASKETBALL_ID,
    name: 'Basketball Jersey',
    tone: 'accent',
    status: 'active',
    isOthers: false,
    useCount: 12,
    recordedBy: null,
    recordedAt: '2026-10-07T02:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    version: 'AAAAAAAAB9E=',
    ...overrides,
  };
}

export function codedProblem(status: number, code: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code }), { status, headers: PROBLEM });
}

const noContent = (): Response => new HttpResponse(null, { status: 204 });

/** What the fake API answers for a list: the rows, or a ready-made response. */
export type ListResponder = (url: URL) => readonly OrderListItemFixture[] | Response | Promise<readonly OrderListItemFixture[] | Response>;

/** Answers GET /api/v1/{route} and records every request URL. A later call overrides an earlier one. */
export function listBackend(
  route: OrderListRoute,
  answer: readonly OrderListItemFixture[] | ListResponder,
): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get(`*/api/v1/${route}`, async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

/** Answers POST /api/v1/{route} (default: 201 with a new entry) and records each body and Idempotency-Key. */
export function createEntryBackend(
  route: OrderListRoute,
  reply: () => Response | Promise<Response> = () =>
    HttpResponse.json(entryDetail({ id: '1f0e2d3c-4b5a-4968-8776-655443322110', name: 'Hoodie', tone: 'info' }), {
      status: 201,
    }),
): CategoryWriteCalls {
  const calls: CategoryWriteCalls = { ids: [], bodies: [], keys: [] };
  server.use(
    http.post(`*/api/v1/${route}`, async ({ request }) => {
      calls.bodies.push(await request.json());
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return calls;
}

/** What the fake API answers for one detail read: the detail, or a ready-made response. */
export type EntryDetailResponder = (
  id: string,
) => OrderListEntryDetailFixture | Response | Promise<OrderListEntryDetailFixture | Response>;

/** Answers GET /api/v1/{route}/{id} and records each id read. */
export function entryDetailBackend(
  route: OrderListRoute,
  answer: OrderListEntryDetailFixture | EntryDetailResponder = entryDetail(),
): { ids: string[] } {
  const ids: string[] = [];
  server.use(
    http.get(`*/api/v1/${route}/:id`, async ({ params }) => {
      const id = String(params.id);
      ids.push(id);
      const body = typeof answer === 'function' ? await answer(id) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { ids };
}

/** Answers PUT /api/v1/{route}/{id} (default: 200 with `entryDetail()`) and records each id, body and Idempotency-Key. */
export function updateEntryBackend(
  route: OrderListRoute,
  reply: () => Response | Promise<Response> = () => HttpResponse.json(entryDetail()),
): CategoryWriteCalls {
  const calls: CategoryWriteCalls = { ids: [], bodies: [], keys: [] };
  server.use(
    http.put(`*/api/v1/${route}/:id`, async ({ params, request }) => {
      calls.ids.push(String(params.id));
      calls.bodies.push(await request.json());
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return calls;
}

function actionBackend(
  verb: 'post' | 'delete',
  path: string,
  reply: (id: string) => Response | Promise<Response>,
): ActionCalls {
  const calls: ActionCalls = { ids: [], keys: [] };
  const handler = ({ params, request }: { params: Record<string, unknown>; request: Request }) => {
    const id = String(params.id);
    calls.ids.push(id);
    calls.keys.push(request.headers.get('Idempotency-Key'));
    return reply(id);
  };
  server.use(verb === 'post' ? http.post(path, handler) : http.delete(path, handler));
  return calls;
}

/** Answers POST /api/v1/{route}/{id}/retire (default: 204) and records each id and Idempotency-Key. */
export function retireEntryBackend(
  route: OrderListRoute,
  reply: (id: string) => Response | Promise<Response> = noContent,
): ActionCalls {
  return actionBackend('post', `*/api/v1/${route}/:id/retire`, reply);
}

/** Answers POST /api/v1/{route}/{id}/reactivate (default: 204) and records each id and Idempotency-Key. */
export function reactivateEntryBackend(
  route: OrderListRoute,
  reply: (id: string) => Response | Promise<Response> = noContent,
): ActionCalls {
  return actionBackend('post', `*/api/v1/${route}/:id/reactivate`, reply);
}

/** Answers DELETE /api/v1/{route}/{id} (default: 204) and records each id. */
export function deleteEntryBackend(
  route: OrderListRoute,
  reply: (id: string) => Response | Promise<Response> = noContent,
): ActionCalls {
  return actionBackend('delete', `*/api/v1/${route}/:id`, reply);
}
