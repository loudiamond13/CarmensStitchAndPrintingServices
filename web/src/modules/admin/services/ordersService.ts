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
  get(id: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
  create(body: CreateOrderRequest, idempotencyKey: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
  updateDetails(id: string, body: UpdateOrderDetailsRequest, signal?: AbortSignal): Promise<OrderDetailResponse>;
  changeStatus(id: string, status: string, idempotencyKey: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

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
    get: () => Promise.reject(new Error('not implemented')),
    create: () => Promise.reject(new Error('not implemented')),
    updateDetails: () => Promise.reject(new Error('not implemented')),
    changeStatus: () => Promise.reject(new Error('not implemented')),
    remove: () => Promise.reject(new Error('not implemented')),
  };
}

export const ordersService: OrdersService = createOrdersService(apiClient);
