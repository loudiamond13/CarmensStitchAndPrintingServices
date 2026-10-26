// The Company Expenses list (E1). Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the previous
// page's rows on screen while the next one loads.
import { useListQuery } from '@/lib/query/useListQuery';
import { expensesService, type ExpensesListQuery } from '@/modules/admin/services/expensesService';

/** The root of every expense list query: invalidating it reads each page again (after an add, edit, delete or restore). */
export const expensesKey = ['company-expenses'] as const;

export function useExpensesQuery(params: ExpensesListQuery) {
  return useListQuery({
    key: expensesKey[0],
    params,
    fetcher: (query, signal) => expensesService.list(query, signal),
  });
}
