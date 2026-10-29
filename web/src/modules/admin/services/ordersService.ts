// Order-level calls (ORD-01, OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type OrderListResponse = Schemas['OrderListResponse'];
export type OrderListEntry = Schemas['OrderListEntry'];

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
  list(query: OrdersListQuery, signal?: AbortSignal): Promise<OrderListResponse>;
}

export function createOrdersService(client: HttpClient): OrdersService {
  return {
    list: (query, signal) => client.get<OrderListResponse>('/orders', { params: { page: query.page }, signal }),
  };
}

export const ordersService: OrdersService = createOrdersService(apiClient);
