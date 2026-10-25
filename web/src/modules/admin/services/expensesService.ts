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
export type ExpenseDetailResponse = Schemas['CompanyExpenseDetailResponse'];
export type CreateExpenseRequest = Schemas['CreateCompanyExpenseRequest'];
export type UpdateExpenseRequest = Schemas['UpdateCompanyExpenseRequest'];

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
  /**
   * `POST /api/v1/company-expenses`: records one expense (CEXP-02). The caller supplies one Idempotency-Key per submission,
   * so a double press or a retry saves it once. 400 lists the field errors, 201 answers the saved expense with its version.
   */
  create(body: CreateExpenseRequest, idempotencyKey: string, signal?: AbortSignal): Promise<ExpenseDetailResponse>;
  /**
   * `GET /api/v1/company-expenses/{id}`: one expense with its notes, its recorder and last editor, whether the caller may
   * edit it, and the row version a save must send back (CEXP-02, CEXP-04). 404 when it was deleted.
   */
  get(id: string, signal?: AbortSignal): Promise<ExpenseDetailResponse>;
  /**
   * `PUT /api/v1/company-expenses/{id}`: saves the form (CEXP-02). The body carries the row version the form was opened with:
   * 409 `edit.stale` when it is not the stored one, 403 `company-expenses.not-yours` for an Admin who may not edit it, 404
   * when it was deleted. A form edit is never retried, so it carries no Idempotency-Key (SEC-07).
   */
  update(id: string, body: UpdateExpenseRequest, signal?: AbortSignal): Promise<ExpenseDetailResponse>;
}

const expensePath = (id: string): string => `/company-expenses/${encodeURIComponent(id)}`;

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
    create: (body, idempotencyKey, signal) =>
      client.post<ExpenseDetailResponse>('/company-expenses', body, { idempotencyKey, signal }),
    get: (id, signal) => client.get<ExpenseDetailResponse>(expensePath(id), { signal }),
    update: (id, body, signal) => client.put<ExpenseDetailResponse>(expensePath(id), body, { signal }),
  };
}

export const expensesService: ExpensesService = createExpensesService(apiClient);
