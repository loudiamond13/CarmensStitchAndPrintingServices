// Every expense change reads the lists, the month figures and the deleted list again (UI-SPEC Freshness; plan 06-16). The answer
// resolves once all three have been asked, so a caller can move focus after the new rows are in the cache.
import { useQueryClient } from '@tanstack/react-query';
import { expenseKpisKey } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expensesDeletedKey, expensesKey } from '@/modules/admin/hooks/useExpensesQuery';

export function useRefreshExpenses(): () => Promise<unknown> {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: expenseKpisKey }),
      queryClient.invalidateQueries({ queryKey: expensesDeletedKey }),
      queryClient.invalidateQueries({ queryKey: expensesKey }),
    ]);
}
