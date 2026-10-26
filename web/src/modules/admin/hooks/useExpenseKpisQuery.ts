// The month figures above the expense list (CEXP-03, D-24). They take no filters, so the key holds no list params and a
// search, filter or page change never reads them again.
import { useQuery } from '@tanstack/react-query';
import { expensesService } from '@/modules/admin/services/expensesService';

/** The key of the KPI query: invalidate it after every expense add, edit, delete or restore so the totals stay the server's. */
export const expenseKpisKey = ['company-expense-kpis'] as const;

export function useExpenseKpisQuery() {
  return useQuery({
    queryKey: expenseKpisKey,
    queryFn: ({ signal }) => expensesService.kpis(signal),
  });
}
