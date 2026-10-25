// Company expense calls (CEXP-01, D-25; plan 06-04). Types come from the generated OpenAPI types, never from utils/csps.ts.
// Both roles may list; the server marks which rows the caller may edit. A null or missing search, filter or date is not sent.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ExpenseListItem = Schemas['CompanyExpenseListItem'];
export type ExpenseListResponse = Schemas['CompanyExpenseListResponse'];
export type ExpenseCategoryRef = Schemas['ExpenseCategoryRef'];
export type ActorRef = Schemas['ActorRef'];
export type ExpenseKpisResponse = Schemas['CompanyExpenseKpisResponse'];

/** What `GET /api/v1/company-expenses` is asked for. Dates are `yyyy-MM-dd` and travel as a pair, or not at all. */
export interface ExpensesListQuery {
  q?: string | null | undefined;
  category?: string | null | undefined;
  from?: string | null | undefined;
  to?: string | null | undefined;
  page: number;
  pageSize: number;
}

export interface ExpensesService {
  /**
   * `GET /api/v1/company-expenses`: one page of expenses, newest date first, with the count and period total over every page
   * and the window and business today the server used. With no dates the server applies its default window (D-23).
   */
  list(query: ExpensesListQuery, signal?: AbortSignal): Promise<ExpenseListResponse>;
  /**
   * `GET /api/v1/company-expenses/kpis`: this month, last month and the top category for the business month (CEXP-03, D-24).
   * It takes no filters: the figures never follow the list.
   */
  kpis(signal?: AbortSignal): Promise<ExpenseKpisResponse>;
}

export function createExpensesService(client: HttpClient): ExpensesService {
  return {
    list: (query, signal) =>
      client.get<ExpenseListResponse>('/company-expenses', {
        params: {
          q: query.q,
          category: query.category,
          from: query.from,
          to: query.to,
          page: query.page,
          pageSize: query.pageSize,
        },
        signal,
      }),
    kpis: (signal) => client.get<ExpenseKpisResponse>('/company-expenses/kpis', { signal }),
  };
}

export const expensesService: ExpensesService = createExpensesService(apiClient);
