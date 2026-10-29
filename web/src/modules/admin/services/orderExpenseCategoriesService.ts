// Order expense category calls (plan 08-04, D-16..D-19). Types come from the generated OpenAPI types. Both roles may list; the writes are the
// Manager's. A save from a form carries the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type OrderExpenseCategoryListItem = Schemas['OrderListItem'];
export type OrderExpenseCategoryDetailResponse = Schemas['OrderListEntryDetailResponse'];
/** The add form: a name and a tone. The server ignores any version on an add. */
export type CreateOrderExpenseCategoryRequest = Omit<Schemas['OrderListEntryRequest'], 'version'>;
/** The edit form: a name, a tone and the row version the form was opened with. */
export type UpdateOrderExpenseCategoryRequest = Schemas['OrderListEntryRequest'];

export interface OrderExpenseCategoriesService {
  /** `GET /api/v1/order-expense-categories`: every order expense category, retired ones included, A to Z. */
  list(signal?: AbortSignal): Promise<OrderExpenseCategoryListItem[]>;
  /**
   * `POST /api/v1/order-expense-categories`: adds an order expense category. The caller supplies one Idempotency-Key per submission.
   * 400 `order-expense-categories.invalid-request` lists the field errors (a duplicate name is one), 409 `auth.session-busy` when the save lost a deadlock.
   */
  create(
    body: CreateOrderExpenseCategoryRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderExpenseCategoryDetailResponse>;
  /** `GET /api/v1/order-expense-categories/{id}`: one order expense category with its use count, who recorded and last changed it, and its row version. 404 `order-expense-categories.not-found`. */
  get(id: string, signal?: AbortSignal): Promise<OrderExpenseCategoryDetailResponse>;
  /**
   * `PUT /api/v1/order-expense-categories/{id}`: saves the form. The body carries the row version the form was opened with: 409 `edit.stale` when it is
   * not the stored one. A form edit is never retried, so it carries no Idempotency-Key (SEC-07). 400 `order-expense-categories.invalid-request`, 404.
   */
  update(
    id: string,
    body: UpdateOrderExpenseCategoryRequest,
    signal?: AbortSignal,
  ): Promise<OrderExpenseCategoryDetailResponse>;
  /** `POST /api/v1/order-expense-categories/{id}/retire`: hides the category from the pickers. It sends no row version; one Idempotency-Key per attempt. 404, and 422 `order-expense-categories.protected` for Others. */
  retire(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/order-expense-categories/{id}/reactivate`: brings a retired category back, with one Idempotency-Key per attempt. 404, and 422 `order-expense-categories.protected` for Others. */
  reactivate(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/order-expense-categories/{id}`: removes a category no order expense has ever used. No row version, no Idempotency-Key. 422 `order-expense-categories.in-use` or `order-expense-categories.protected` (Others), 404. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const entryPath = (id: string): string => `/order-expense-categories/${encodeURIComponent(id)}`;

export function createOrderExpenseCategoriesService(client: HttpClient): OrderExpenseCategoriesService {
  return {
    list: (signal) => client.get<OrderExpenseCategoryListItem[]>('/order-expense-categories', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<OrderExpenseCategoryDetailResponse>('/order-expense-categories', body, { idempotencyKey, signal }),
    get: (id, signal) => client.get<OrderExpenseCategoryDetailResponse>(entryPath(id), { signal }),
    update: (id, body, signal) => client.put<OrderExpenseCategoryDetailResponse>(entryPath(id), body, { signal }),
    retire: (id, idempotencyKey, signal) =>
      client.post(`${entryPath(id)}/retire`, undefined, { idempotencyKey, signal }),
    reactivate: (id, idempotencyKey, signal) =>
      client.post(`${entryPath(id)}/reactivate`, undefined, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(entryPath(id), { signal }),
  };
}

export const orderExpenseCategoriesService: OrderExpenseCategoriesService =
  createOrderExpenseCategoriesService(apiClient);
