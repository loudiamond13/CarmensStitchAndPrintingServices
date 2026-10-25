// Expense category calls (D-11, D-15; plan 06-07). Types come from the generated OpenAPI types. Both roles may list.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type ExpenseCategoryListItem = components['schemas']['ExpenseCategoryListItem'];

export interface ExpenseCategoriesService {
  /** `GET /api/v1/expense-categories`: every category, retired ones included, A to Z with Others last. */
  list(signal?: AbortSignal): Promise<ExpenseCategoryListItem[]>;
}

export function createExpenseCategoriesService(client: HttpClient): ExpenseCategoriesService {
  return {
    list: (signal) => client.get<ExpenseCategoryListItem[]>('/expense-categories', { signal }),
  };
}

export const expenseCategoriesService: ExpenseCategoriesService = createExpenseCategoriesService(apiClient);
