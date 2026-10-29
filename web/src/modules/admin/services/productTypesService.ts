// Product type calls (plan 08-04). Skeleton for the red step.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ProductTypeListItem = Schemas['OrderListItem'];
export type ProductTypeDetailResponse = Schemas['OrderListEntryDetailResponse'];
export type ProductTypeRequest = Schemas['OrderListEntryRequest'];

export interface ProductTypesService {
  list(signal?: AbortSignal): Promise<ProductTypeListItem[]>;
  create(body: ProductTypeRequest, idempotencyKey: string, signal?: AbortSignal): Promise<ProductTypeDetailResponse>;
  get(id: string, signal?: AbortSignal): Promise<ProductTypeDetailResponse>;
  update(id: string, body: ProductTypeRequest, signal?: AbortSignal): Promise<ProductTypeDetailResponse>;
  retire(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  reactivate(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const notBuilt = (): never => {
  throw new Error('not built');
};

export function createProductTypesService(client: HttpClient): ProductTypesService {
  void client;
  return {
    list: notBuilt,
    create: notBuilt,
    get: notBuilt,
    update: notBuilt,
    retire: notBuilt,
    reactivate: notBuilt,
    remove: notBuilt,
  };
}

export const productTypesService: ProductTypesService = createProductTypesService(apiClient);
