// Every expense change reads the lists, the month figures, the deleted list and the category list (its expense counts decide
// the Settings Delete offer) again (UI-SPEC Freshness; plan 06-16). An expense also changes the dashboard's Company expenses card and
// chart, and the payer's money on hand, so the dashboard, staff-money and money-transfers root keys are read again (D-13). The answer resolves once all have been asked, so a caller can move focus
// after the new rows are in the cache.
import { useQueryClient } from '@tanstack/react-query';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { expensesDeletedKey } from '@/modules/admin/hooks/useDeletedExpensesQuery';
import { expenseCategoriesKey } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { expenseKpisKey } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { moneyTransfersKey } from '@/modules/admin/hooks/useTransferRecipientsQuery';

export function useRefreshExpenses(): () => Promise<unknown> {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: expenseKpisKey }),
      queryClient.invalidateQueries({ queryKey: expensesDeletedKey }),
      queryClient.invalidateQueries({ queryKey: expensesKey }),
      queryClient.invalidateQueries({ queryKey: expenseCategoriesKey }),
      queryClient.invalidateQueries({ queryKey: dashboardKey }),
      queryClient.invalidateQueries({ queryKey: staffMoneyKey }),
      queryClient.invalidateQueries({ queryKey: moneyTransfersKey }),
    ]);
}
