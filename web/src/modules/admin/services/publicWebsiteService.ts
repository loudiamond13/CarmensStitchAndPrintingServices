// The Public Website calls of an order (GAL-03, CONT-03; OR-5): the save and the product lines the window offers. Types come from the
// generated OpenAPI types. Both roles may call both.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type SetOrderPublicSettingsRequest = Schemas['SetOrderPublicSettingsRequest'];
export type ProductLineOption = Schemas['ProductLineOptionDto'];

export interface PublicWebsiteService {
  /**
   * `PUT /api/v1/orders/{orderId}/public`: the customer's OK, show or take off, the line and the name shown. The body carries the order
   * `version` the window opened with. A form save is never retried, so it sends no Idempotency-Key. `409 edit.stale`,
   * `400` lists the field errors, `404 orders.not-found`, `422 orders.public-cancelled` for a Cancelled order.
   */
  save(orderId: string, body: SetOrderPublicSettingsRequest, signal?: AbortSignal): Promise<OrderDetailResponse>;
  /** `GET /api/v1/product-lines/options`: the active lines, `{ id, title, shortName }`, in display order. */
  lineOptions(signal?: AbortSignal): Promise<ProductLineOption[]>;
}

export function createPublicWebsiteService(client: HttpClient): PublicWebsiteService {
  return {
    save: (orderId, body, signal) =>
      client.put<OrderDetailResponse>(`/orders/${encodeURIComponent(orderId)}/public`, body, { signal }),
    lineOptions: (signal) => client.get<ProductLineOption[]>('/product-lines/options', { signal }),
  };
}

export const publicWebsiteService: PublicWebsiteService = createPublicWebsiteService(apiClient);
