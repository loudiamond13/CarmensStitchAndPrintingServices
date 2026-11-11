// Everyone's money on hand, for a Manager only (MONEY-03, D-42 to D-44). The browser never asks as an Admin: `enabled` is the role check,
// and the server answers 403 anyway. It is live, so it is read again on every visit; it lives under the staff-money root, so every money
// write and every roster change that invalidates that root reads it again.
import { useQuery } from '@tanstack/react-query';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { moneyService, parseStaffBalances, type StaffBalances } from '@/modules/admin/services/moneyService';

/** What the All Staff table reads of the query, so the table never owns the request and a test can hand it plain values. */
export interface StaffBalancesTableQuery {
  readonly data: StaffBalances | undefined;
  readonly isError: boolean;
  /** True while a read runs, so the table can say that Try Again is working. */
  readonly isFetching: boolean;
  readonly error: unknown;
  readonly refetch: () => unknown;
}

export const staffBalancesKey = [...staffMoneyKey, 'all'] as const;

export function useStaffBalancesQuery(enabled: boolean) {
  return useQuery({
    queryKey: staffBalancesKey,
    // An answer with a figure or a status the browser cannot trust fails the query, so the table shows its alert, not a wrong row.
    queryFn: async ({ signal }): Promise<StaffBalances> => parseStaffBalances(await moneyService.staff(signal)),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
