// Discount calls on one order (ORD-07, OR-5). Every answer is the whole order: the server's figures and the new row version.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AddOrderDiscountRequest = Schemas['AddOrderDiscountRequest'];
export type UpdateOrderDiscountRequest = Schemas['UpdateOrderDiscountRequest'];

export interface OrderDiscountsService {
  /**
   * `POST /api/v1/orders/{orderId}/discounts`: gives a discount. The body carries the order `version` the window opened with,
   * and the caller supplies one Idempotency-Key per submission. `409 edit.stale`, `422 orders.locked`,
   * `orders.too-many-discounts` or `orders.discount-above-subtotal`, `404 orders.not-found`, `400` lists the field errors.
   */
  add(
    orderId: string,
    body: AddOrderDiscountRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/discounts/{discountId}`: changes a discount. The body carries the `version` the window opened
   * with. A form save is never retried, so it sends no Idempotency-Key. `404 orders.discount-not-found`, `409 edit.stale`.
   */
  update(
    orderId: string,
    discountId: string,
    body: UpdateOrderDiscountRequest,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `DELETE /api/v1/orders/{orderId}/discounts/{discountId}`: removes a discount. It acts on the latest state, so it sends no
   * version, and a DELETE repeats safely, so it sends no Idempotency-Key. `404 orders.discount-not-found`.
   */
  remove(orderId: string, discountId: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
}

const discountsPath = (orderId: string): string => `/orders/${encodeURIComponent(orderId)}/discounts`;
const discountPath = (orderId: string, discountId: string): string =>
  `${discountsPath(orderId)}/${encodeURIComponent(discountId)}`;

export function createOrderDiscountsService(client: HttpClient): OrderDiscountsService {
  return {
    add: (orderId, body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(discountsPath(orderId), body, { idempotencyKey, signal }),
    update: (orderId, discountId, body, signal) =>
      client.put<OrderDetailResponse>(discountPath(orderId, discountId), body, { signal }),
    remove: (orderId, discountId, signal) =>
      client.delete<OrderDetailResponse>(discountPath(orderId, discountId), { signal }),
  };
}

export const orderDiscountsService: OrderDiscountsService = createOrderDiscountsService(apiClient);
