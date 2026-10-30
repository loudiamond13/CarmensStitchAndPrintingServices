// Refund calls on one order (ORD-07, ORD-18, OR-5). Every answer is the whole order: the server's figures and the new row version.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AddOrderRefundRequest = Schemas['AddOrderRefundRequest'];
export type UpdateOrderRefundRequest = Schemas['UpdateOrderRefundRequest'];

export interface OrderRefundsService {
  /**
   * `POST /api/v1/orders/{orderId}/refunds`: records a refund. The body carries the order `version` the window opened with,
   * and the caller supplies one Idempotency-Key per submission. `409 edit.stale`, `422 orders.locked` or
   * `orders.refund-not-allowed`, `404 orders.not-found`, `400` lists the field errors (an amount above the cap is one).
   */
  add(
    orderId: string,
    body: AddOrderRefundRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/refunds/{refundId}`: changes a refund. The body carries the `version` the window opened
   * with. A form save is never retried, so it sends no Idempotency-Key. `404 orders.refund-not-found`, `409 edit.stale`,
   * `422 orders.locked`.
   */
  update(
    orderId: string,
    refundId: string,
    body: UpdateOrderRefundRequest,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `DELETE /api/v1/orders/{orderId}/refunds/{refundId}`: removes a refund. It acts on the latest state, so it sends no
   * version, and a DELETE repeats safely, so it sends no Idempotency-Key. `404 orders.refund-not-found`, `422 orders.locked`.
   */
  remove(orderId: string, refundId: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
}

const refundsPath = (orderId: string): string => `/orders/${encodeURIComponent(orderId)}/refunds`;
const refundPath = (orderId: string, refundId: string): string =>
  `${refundsPath(orderId)}/${encodeURIComponent(refundId)}`;

export function createOrderRefundsService(client: HttpClient): OrderRefundsService {
  return {
    add: (orderId, body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(refundsPath(orderId), body, { idempotencyKey, signal }),
    update: (orderId, refundId, body, signal) =>
      client.put<OrderDetailResponse>(refundPath(orderId, refundId), body, { signal }),
    remove: (orderId, refundId, signal) =>
      client.delete<OrderDetailResponse>(refundPath(orderId, refundId), { signal }),
  };
}

export const orderRefundsService: OrderRefundsService = createOrderRefundsService(apiClient);
