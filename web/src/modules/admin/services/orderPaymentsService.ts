// Payment calls on one order (ORD-07, OR-5). Every answer is the whole order: the server's figures and the new row version.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AddOrderPaymentRequest = Schemas['AddOrderPaymentRequest'];
export type UpdateOrderPaymentRequest = Schemas['UpdateOrderPaymentRequest'];

export interface OrderPaymentsService {
  /**
   * `POST /api/v1/orders/{orderId}/payments`: records a payment. The body carries the order `version` the window opened with,
   * and the caller supplies one Idempotency-Key per submission. `409 edit.stale`, `422 orders.locked` or
   * `orders.too-many-payments`, `404 orders.not-found`, `400` lists the field errors (the amount above the balance is one).
   */
  add(
    orderId: string,
    body: AddOrderPaymentRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/payments/{paymentId}`: changes a payment. The body carries the `version` the window opened
   * with. A form save is never retried, so it sends no Idempotency-Key. `404 orders.payment-not-found`, `409 edit.stale`,
   * `422 orders.payment-below-refunds`.
   */
  update(
    orderId: string,
    paymentId: string,
    body: UpdateOrderPaymentRequest,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `DELETE /api/v1/orders/{orderId}/payments/{paymentId}`: removes a payment. It acts on the latest state, so it sends no
   * version, and a DELETE repeats safely, so it sends no Idempotency-Key. `422 orders.payment-below-refunds`,
   * `404 orders.payment-not-found`.
   */
  remove(orderId: string, paymentId: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
}

const paymentsPath = (orderId: string): string => `/orders/${encodeURIComponent(orderId)}/payments`;
const paymentPath = (orderId: string, paymentId: string): string =>
  `${paymentsPath(orderId)}/${encodeURIComponent(paymentId)}`;

export function createOrderPaymentsService(client: HttpClient): OrderPaymentsService {
  return {
    add: (orderId, body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(paymentsPath(orderId), body, { idempotencyKey, signal }),
    update: (orderId, paymentId, body, signal) =>
      client.put<OrderDetailResponse>(paymentPath(orderId, paymentId), body, { signal }),
    remove: (orderId, paymentId, signal) =>
      client.delete<OrderDetailResponse>(paymentPath(orderId, paymentId), { signal }),
  };
}

export const orderPaymentsService: OrderPaymentsService = createOrderPaymentsService(apiClient);
