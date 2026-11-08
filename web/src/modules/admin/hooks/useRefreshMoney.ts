// Every transfer changes balances, so the staff-money answers (the caller's money, ledger, staff balances), the transfer lists and the
// dashboard are read again (D-13). The answer resolves once all have been asked, so a caller can move focus after the new rows arrive.
import { useQueryClient } from '@tanstack/react-query';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { moneyTransfersKey } from '@/modules/admin/hooks/useTransferRecipientsQuery';

export function useRefreshMoney(): () => Promise<unknown> {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [staffMoneyKey, moneyTransfersKey, dashboardKey].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}
