// Order-level calls (ORD-01, OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type OrderListResponse = Schemas['OrderListResponse'];
export type OrderListEntry = Schemas['OrderListEntry'];
export type OrderDetailResponse = Schemas['OrderDetailResponse'];
export type CreateOrderRequest = Schemas['CreateOrderRequest'];
export type UpdateOrderDetailsRequest = Schemas['UpdateOrderDetailsRequest'];

/** What `GET /api/v1/orders` is asked for. A null or missing value is not sent. */
export interface OrdersListQuery {
  q?: string | null | undefined;
  status?: string | null | undefined;
  from?: string | null | undefined;
  to?: string | null | undefined;
  productType?: string | null | undefined;
  hasBalance?: boolean | null | undefined;
  sort?: string | null | undefined;
  page: number;
  pageSize: number;
}

export interface OrdersService {
  /**
   * `GET /api/v1/orders`: one page of orders with their stored money figures and piece counts, plus the list-wide counts
   * (`allOrders`, `activeOrders`, which ignore every filter) and the business `today` (D-41, D-59). With no filters the
   * server shows the active orders, soonest due first. 400 lists the field errors of a bad filter.
   */
  list(query: OrdersListQuery, signal?: AbortSignal): Promise<OrderListResponse>;
  /**
   * `GET /api/v1/orders/{id}`: one order with its items, discounts, payments, expenses, refunds, status history, the business
   * `today` and the row `version` a save must send back. `404 orders.not-found` when it is missing or deleted.
   */
  get(id: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
  /**
   * `POST /api/v1/orders`: saves a new order with its items (and any payments, discounts and expenses) in one call. The caller
   * supplies one Idempotency-Key per submission, so a double press or a retry saves it once. `400` lists the field errors,
   * `409 orders.busy` means saving is busy and nothing was saved, `201` answers the order with its number and version.
   */
  create(body: CreateOrderRequest, idempotencyKey: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{id}`: saves the details form (customer, contact, dates, notes). The body carries the `version` the form
   * was opened with: `409 edit.stale` when it is not the stored one, `422 orders.locked` while the order is Completed or
   * Cancelled, `404 orders.not-found`. A form save is never retried, so it carries no Idempotency-Key.
   */
  updateDetails(id: string, body: UpdateOrderDetailsRequest, signal?: AbortSignal): Promise<OrderDetailResponse>;
  /**
   * `POST /api/v1/orders/{id}/status`: moves the order to another status. The caller supplies one Idempotency-Key per attempt.
   * It acts on the latest state, so it sends no row version. `422 orders.complete-balance-owed`, `orders.complete-credit` or
   * `orders.reopen-first` refuse a move, `409 edit.stale` follows two lost races, `404 orders.not-found`.
   */
  changeStatus(id: string, status: string, idempotencyKey: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
  /**
   * `DELETE /api/v1/orders/{id}`: soft-deletes the order. It acts on the latest state, so it sends no row version, and a DELETE
   * repeats safely, so it sends no Idempotency-Key. `404 orders.not-found` when it is already deleted, `409 edit.stale` after
   * two lost races.
   */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const orderPath = (id: string): string => `/orders/${encodeURIComponent(id)}`;

export function createOrdersService(client: HttpClient): OrdersService {
  return {
    list: (query, signal) =>
      client.get<OrderListResponse>('/orders', {
        params: {
          q: query.q,
          status: query.status,
          from: query.from,
          to: query.to,
          productType: query.productType,
          hasBalance: query.hasBalance,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        },
        signal,
      }),
    get: (id, signal) => client.get<OrderDetailResponse>(orderPath(id), { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>('/orders', body, { idempotencyKey, signal }),
    updateDetails: (id, body, signal) => client.put<OrderDetailResponse>(orderPath(id), body, { signal }),
    changeStatus: (id, status, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(`${orderPath(id)}/status`, { status }, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(orderPath(id), { signal }),
  };
}

export const ordersService: OrdersService = createOrdersService(apiClient);
