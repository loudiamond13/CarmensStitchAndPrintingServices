// Expense category calls (D-08..D-15; plans 06-07, 06-17). Types come from the generated OpenAPI types. Both roles may list; the
// writes are the Manager's. A save from a form carries the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per
// submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ExpenseCategoryListItem = Schemas['ExpenseCategoryListItem'];
export type ExpenseCategoryDetailResponse = Schemas['ExpenseCategoryDetailResponse'];
export type CreateExpenseCategoryRequest = Schemas['CreateExpenseCategoryRequest'];
export type UpdateExpenseCategoryRequest = Schemas['UpdateExpenseCategoryRequest'];

export interface ExpenseCategoriesService {
  /** `GET /api/v1/expense-categories`: every category, retired ones included, A to Z with Others last. */
  list(signal?: AbortSignal): Promise<ExpenseCategoryListItem[]>;
  /**
   * `POST /api/v1/expense-categories`: adds a category (D-08, D-13). The caller supplies one Idempotency-Key per submission.
   * 400 lists the field errors (a duplicate name is one), 201 answers the new category.
   */
  create(
    body: CreateExpenseCategoryRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ExpenseCategoryListItem>;
  /** `GET /api/v1/expense-categories/{id}`: one category with its usage count, who recorded and last changed it, and its row version. */
  get(id: string, signal?: AbortSignal): Promise<ExpenseCategoryDetailResponse>;
  /**
   * `PUT /api/v1/expense-categories/{id}`: saves the form (D-12, D-13). The body carries the row version the form was opened with:
   * 409 `edit.stale` when it is not the stored one. A form edit is never retried, so it carries no Idempotency-Key (SEC-07).
   */
  update(id: string, body: UpdateExpenseCategoryRequest, signal?: AbortSignal): Promise<ExpenseCategoryDetailResponse>;
}

const categoryPath = (id: string): string => `/expense-categories/${encodeURIComponent(id)}`;

export function createExpenseCategoriesService(client: HttpClient): ExpenseCategoriesService {
  return {
    list: (signal) => client.get<ExpenseCategoryListItem[]>('/expense-categories', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<ExpenseCategoryListItem>('/expense-categories', body, { idempotencyKey, signal }),
    get: (id, signal) => client.get<ExpenseCategoryDetailResponse>(categoryPath(id), { signal }),
    update: (id, body, signal) => client.put<ExpenseCategoryDetailResponse>(categoryPath(id), body, { signal }),
  };
}

export const expenseCategoriesService: ExpenseCategoriesService = createExpenseCategoriesService(apiClient);
