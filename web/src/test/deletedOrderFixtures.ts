// Deleted order fixtures for component, service and page tests (plan 08-20): response builders typed from the generated
// contract, and MSW handlers for the Manager's deleted-orders routes that record every request. Fake data only.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import {
  buildOrderDetail,
  order0148,
  orderId,
  orderRefund,
  ORDER_STAFF,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type DeletedOrderItemFixture = Schemas['DeletedOrderListItem'];
export type DeletedOrderListFixture = Schemas['DeletedOrderListResponse'];
export type DeletedOrderDetailFixture = Schemas['DeletedOrderDetailResponse'];

/** One row of the deleted list: ORD-2026-0148, deleted by Carmen at 3:42 PM Manila time on Oct 12, 2026 unless a test says. */
export function deletedOrderItem(
  id: string,
  overrides: Partial<DeletedOrderItemFixture> = {},
): DeletedOrderItemFixture {
  return {
    id,
    number: 'ORD-2026-0148',
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    status: 'production',
    total: 21327.5,
    paid: 12000,
    balance: 9327.5,
    deletedAt: '2026-10-12T07:42:00Z',
    deletedBy: ORDER_STAFF,
    ...overrides,
  };
}

export function deletedOrderList(
  items: readonly DeletedOrderItemFixture[],
  overrides: Partial<DeletedOrderListFixture> = {},
): DeletedOrderListFixture {
  return { items: [...items], total: items.length, page: 1, pageSize: 20, ...overrides };
}

/** A deleted order as GET /orders/deleted/{id} answers it: the order with every child row, plus when and by whom. */
export function deletedOrderDetail(
  order: OrderDetailFixture = order0148,
  overrides: Partial<DeletedOrderDetailFixture> = {},
): DeletedOrderDetailFixture {
  return { order, deletedAt: '2026-10-12T07:42:00Z', deletedBy: ORDER_STAFF, ...overrides };
}

/** An order that holds only the child rows asked for, for the permanent-delete tiles. */
export function orderWithCounts(
  number: string,
  counts: { items?: number; payments?: number; discounts?: number; expenses?: number; refunds?: number },
  id: string = orderId(9),
): OrderDetailFixture {
  const base = buildOrderDetail({ id, number });
  const take = <T>(rows: readonly T[], count: number | undefined): T[] =>
    Array.from({ length: count ?? 0 }, (_unused, index) => rows[index % rows.length] as T);
  return {
    ...base,
    items: take(base.items, counts.items),
    payments: take(base.payments, counts.payments),
    discounts: take(base.discounts, counts.discounts),
    expenses: take(base.expenses, counts.expenses),
    refunds: take([orderRefund('2026-10-04', 100, 'Test refund')], counts.refunds),
  };
}

/** A problem+json answer with a status. */
export function deletedProblem(status: number): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export type DeletedResult<T> = T | Response | Promise<T | Response>;

export interface DeletedOrdersOptions {
  /** The deleted list answer, or a function of the request URL. */
  list: DeletedOrderListFixture | ((url: URL) => DeletedResult<DeletedOrderListFixture>);
  /** The deleted order GET /orders/deleted/{id} answers, or a function of the id. Default: ORD-2026-0148 with its children. */
  detail?: DeletedOrderDetailFixture | ((id: string) => DeletedResult<DeletedOrderDetailFixture>);
  /** What POST /orders/{id}/restore answers. Default: 204. */
  restore?: (id: string) => Response | Promise<Response>;
  /** What DELETE /orders/{id}/permanent answers; the typed confirm text is given. Default: 204. */
  purge?: (id: string, confirm: string | null) => Response | Promise<Response>;
}

/** What the fake API recorded. */
export interface DeletedOrdersBackend {
  /** Every GET /orders/deleted request URL. */
  lists: URL[];
  /** Every id read through GET /orders/deleted/{id}. */
  reads: string[];
  /** Every restore: the id and the Idempotency-Key. */
  restores: { id: string; key: string | null }[];
  /** Every permanent delete: the id, the confirm query value and any Idempotency-Key (there should be none). */
  purges: { id: string; confirm: string | null; key: string | null }[];
}

const noContent = (): Response => new HttpResponse(null, { status: 204 });

async function resolve<T>(source: T | ((arg: never) => DeletedResult<T>), arg: unknown): Promise<T | Response> {
  return typeof source === 'function' ? await (source as (value: unknown) => DeletedResult<T>)(arg) : source;
}

/** Answers and records the four Manager routes of Deleted Orders. A later call replaces an earlier one. */
export function deletedOrdersBackend(options: DeletedOrdersOptions): DeletedOrdersBackend {
  const backend: DeletedOrdersBackend = { lists: [], reads: [], restores: [], purges: [] };
  server.use(
    http.get('*/api/v1/orders/deleted', async ({ request }) => {
      const url = new URL(request.url);
      backend.lists.push(url);
      const body = await resolve(options.list, url);
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
    http.get('*/api/v1/orders/deleted/:id', async ({ params }) => {
      const id = String(params.id);
      backend.reads.push(id);
      const body = await resolve(options.detail ?? deletedOrderDetail(), id);
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
    http.post('*/api/v1/orders/:id/restore', ({ params, request }) => {
      const id = String(params.id);
      backend.restores.push({ id, key: request.headers.get('Idempotency-Key') });
      return (options.restore ?? noContent)(id);
    }),
    http.delete('*/api/v1/orders/:id/permanent', ({ params, request }) => {
      const id = String(params.id);
      const confirm = new URL(request.url).searchParams.get('confirm');
      backend.purges.push({ id, confirm, key: request.headers.get('Idempotency-Key') });
      return (options.purge ?? noContent)(id, confirm);
    }),
  );
  return backend;
}
