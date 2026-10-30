// Item calls on one order (ORD-05, OR-5). Every answer is the whole order: the server's figures and the new row version.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AddOrderItemRequest = Schemas['AddOrderItemRequest'];
export type UpdateOrderItemRequest = Schemas['UpdateOrderItemRequest'];

export interface OrderItemsService {
  /**
   * `POST /api/v1/orders/{orderId}/items`: adds an item. The body carries the order `version` the window opened with, and the
   * caller supplies one Idempotency-Key per submission. `409 edit.stale`, `422 orders.locked`, `orders.too-many-items` or
   * `orders.discount-above-subtotal`, `404 orders.not-found`, `400` lists the field errors.
   */
  add(
    orderId: string,
    body: AddOrderItemRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/items/{itemId}`: changes an item. The body carries the `version` the window opened with. A form
   * save is never retried, so it sends no Idempotency-Key. `404 orders.item-not-found`, `409 edit.stale`.
   */
  update(
    orderId: string,
    itemId: string,
    body: UpdateOrderItemRequest,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `DELETE /api/v1/orders/{orderId}/items/{itemId}`: removes an item. It acts on the latest state, so it sends no version, and
   * a DELETE repeats safely, so it sends no Idempotency-Key. `422 orders.last-item`, `404 orders.item-not-found`.
   */
  remove(orderId: string, itemId: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
}

const itemsPath = (orderId: string): string => `/orders/${encodeURIComponent(orderId)}/items`;
const itemPath = (orderId: string, itemId: string): string => `${itemsPath(orderId)}/${encodeURIComponent(itemId)}`;

export function createOrderItemsService(client: HttpClient): OrderItemsService {
  return {
    add: (orderId, body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(itemsPath(orderId), body, { idempotencyKey, signal }),
    update: (orderId, itemId, body, signal) =>
      client.put<OrderDetailResponse>(itemPath(orderId, itemId), body, { signal }),
    remove: (orderId, itemId, signal) => client.delete<OrderDetailResponse>(itemPath(orderId, itemId), { signal }),
  };
}

export const orderItemsService: OrderItemsService = createOrderItemsService(apiClient);
