// Deleted-order calls for Managers (ORD-06, OR-5). Types come from the generated OpenAPI types.
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
  list(query: DeletedOrdersListQuery, signal?: AbortSignal): Promise<DeletedOrderListResponse>;
  get(id: string, signal?: AbortSignal): Promise<DeletedOrderDetailResponse>;
  restore(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  purge(id: string, confirm: string, signal?: AbortSignal): Promise<void>;
}

const notBuilt = (): never => {
  throw new Error('Not built yet.');
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- a stub until the next commit.
export function createDeletedOrdersService(client: HttpClient): DeletedOrdersService {
  return { list: notBuilt, get: notBuilt, restore: notBuilt, purge: notBuilt };
}

export const deletedOrdersService: DeletedOrdersService = createDeletedOrdersService(apiClient);
