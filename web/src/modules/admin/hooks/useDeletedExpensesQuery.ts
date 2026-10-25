// The Manager's Deleted Expenses list (E4). Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the
// previous page's rows on screen while the next one loads. Its root is expensesDeletedKey, which every expense change invalidates.
import { useListQuery } from '@/lib/query/useListQuery';
import { expensesService, type DeletedExpensesListQuery } from '@/modules/admin/services/expensesService';

export function useDeletedExpensesQuery(params: DeletedExpensesListQuery) {
  return useListQuery({
    key: 'company-expenses-deleted',
    params,
    fetcher: (query, signal) => expensesService.listDeleted(query, signal),
  });
}
