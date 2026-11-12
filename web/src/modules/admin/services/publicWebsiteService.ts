// STUB for the RED commit of plan 11-27 task 1; replaced in GREEN.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type SetOrderPublicSettingsRequest = Schemas['SetOrderPublicSettingsRequest'];
export type ProductLineOption = Schemas['ProductLineOptionDto'];

export interface PublicWebsiteService {
  save(orderId: string, body: SetOrderPublicSettingsRequest, signal?: AbortSignal): Promise<OrderDetailResponse>;
  lineOptions(signal?: AbortSignal): Promise<ProductLineOption[]>;
}

export function createPublicWebsiteService(client: HttpClient): PublicWebsiteService {
  void client;
  return {
    save: () => Promise.reject(new Error('not built')),
    lineOptions: () => Promise.resolve([]),
  };
}

export const publicWebsiteService: PublicWebsiteService = createPublicWebsiteService(apiClient);
