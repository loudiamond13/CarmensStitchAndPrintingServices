// Order expense calls on one order (ORD-07, OR-5). Every answer is the whole order: the server's figures and the new row version.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AddOrderExpenseRequest = Schemas['AddOrderExpenseRequest'];
export type UpdateOrderExpenseRequest = Schemas['UpdateOrderExpenseRequest'];

export interface OrderExpensesService {
  /**
   * `POST /api/v1/orders/{orderId}/expenses`: records an expense. The body carries the order `version` the window opened with,
   * and the caller supplies one Idempotency-Key per submission. `409 edit.stale`, `422 orders.locked` or
   * `orders.too-many-expenses`, `404 orders.not-found`, `400` lists the field errors (an inactive payer is one).
   */
  add(
    orderId: string,
    body: AddOrderExpenseRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/expenses/{expenseId}`: changes an expense. The body carries the `version` the window opened
   * with. A form save is never retried, so it sends no Idempotency-Key. `404 orders.expense-not-found`, `409 edit.stale`.
   */
  update(
    orderId: string,
    expenseId: string,
    body: UpdateOrderExpenseRequest,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `DELETE /api/v1/orders/{orderId}/expenses/{expenseId}`: removes an expense. It acts on the latest state, so it sends no
   * version, and a DELETE repeats safely, so it sends no Idempotency-Key. `404 orders.expense-not-found`.
   */
  remove(orderId: string, expenseId: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
}

const expensesPath = (orderId: string): string => `/orders/${encodeURIComponent(orderId)}/expenses`;
const expensePath = (orderId: string, expenseId: string): string =>
  `${expensesPath(orderId)}/${encodeURIComponent(expenseId)}`;

export function createOrderExpensesService(client: HttpClient): OrderExpensesService {
  return {
    add: (orderId, body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(expensesPath(orderId), body, { idempotencyKey, signal }),
    update: (orderId, expenseId, body, signal) =>
      client.put<OrderDetailResponse>(expensePath(orderId, expenseId), body, { signal }),
    remove: (orderId, expenseId, signal) =>
      client.delete<OrderDetailResponse>(expensePath(orderId, expenseId), { signal }),
  };
}

export const orderExpensesService: OrderExpensesService = createOrderExpensesService(apiClient);
