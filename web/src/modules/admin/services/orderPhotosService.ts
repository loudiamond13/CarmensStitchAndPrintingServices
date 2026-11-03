// Photo calls on one order (ORD-04, IMG-01; OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

export type ImageRulesResponse = components['schemas']['ImageRulesResponse'];

export interface OrderPhotosService {
  rules(signal?: AbortSignal): Promise<ImageRulesResponse>;
  upload(
    orderId: string,
    file: Blob,
    fileName: string,
    description: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
}

export function createOrderPhotosService(client: HttpClient): OrderPhotosService {
  void client;
  return {
    rules: () => Promise.reject(new Error('not built')),
    upload: () => Promise.reject(new Error('not built')),
  };
}

export const orderPhotosService: OrderPhotosService = createOrderPhotosService(apiClient);
