// Deleted-order calls for Managers (ORD-06, D-23, D-24, 07 D-28, OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type DeletedOrderListResponse = Schemas['DeletedOrderListResponse'];
export type DeletedOrderListItem = Schemas['DeletedOrderListItem'];
export type DeletedOrderDetailResponse = Schemas['DeletedOrderDetailResponse'];

/** What `GET /api/v1/orders/deleted` is asked for: paging only, no search (D-52). */
export interface DeletedOrdersListQuery {
  page: number;
  pageSize: number;
}

export interface DeletedOrdersService {
  /** `GET /api/v1/orders/deleted`: one page of deleted orders, newest deleted first. `403` for an Admin. */
  list(query: DeletedOrdersListQuery, signal?: AbortSignal): Promise<DeletedOrderListResponse>;
  /**
   * `GET /api/v1/orders/deleted/{id}` (D-24): a deleted order with every child row, when it was deleted and by whom. `404
   * orders.not-found` when the id is live, unknown or was restored meanwhile.
   */
  get(id: string, signal?: AbortSignal): Promise<DeletedOrderDetailResponse>;
  /**
   * `POST /api/v1/orders/{id}/restore`: brings a deleted order back with everything inside it. The caller supplies one
   * Idempotency-Key per attempt; `204`, or `404 orders.not-found` when the order is not deleted.
   */
  restore(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /**
   * `DELETE /api/v1/orders/{id}/permanent?confirm=`: removes the order and every row inside it for good. `confirm` is the order
   * number typed exactly; `400` on `confirm` when it differs, `404 orders.not-found` when the order is gone. A DELETE repeats
   * safely, so it sends no Idempotency-Key.
   */
  purge(id: string, confirm: string, signal?: AbortSignal): Promise<void>;
}

const orderPath = (id: string): string => `/orders/${encodeURIComponent(id)}`;

export function createDeletedOrdersService(client: HttpClient): DeletedOrdersService {
  return {
    list: (query, signal) =>
      client.get<DeletedOrderListResponse>('/orders/deleted', {
        params: { page: query.page, pageSize: query.pageSize },
        signal,
      }),
    get: (id, signal) =>
      client.get<DeletedOrderDetailResponse>(`/orders/deleted/${encodeURIComponent(id)}`, { signal }),
    restore: (id, idempotencyKey, signal) =>
      client.post(`${orderPath(id)}/restore`, undefined, { idempotencyKey, signal }),
    purge: (id, confirm, signal) => client.delete(`${orderPath(id)}/permanent`, { params: { confirm }, signal }),
  };
}

export const deletedOrdersService: DeletedOrdersService = createDeletedOrdersService(apiClient);
