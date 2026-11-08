// One person's money on hand, for a Manager (MONEY-03, D-42). The figure is live, so it is read again on every visit. `userId` is null
// when the address named no valid id: nothing is asked then. It lives under the staff-money root, so every money write reads it again.
import { useQuery } from '@tanstack/react-query';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { moneyService, parsePersonMoney, type PersonMoney } from '@/modules/admin/services/moneyService';

export const staffPersonKey = (userId: string) => [...staffMoneyKey, 'person', userId] as const;

/** What a person's money card reads of the query: the same shape as the caller's own, with the person's role and standing. */
export interface PersonMoneyQuery {
  readonly data: PersonMoney | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly error: unknown;
  readonly refetch: () => unknown;
}

export function useStaffMoneyQuery(userId: string | null) {
  return useQuery({
    queryKey: staffPersonKey(userId ?? ''),
    queryFn: async ({ signal }): Promise<PersonMoney> =>
      parsePersonMoney(await moneyService.person(userId ?? '', signal)),
    enabled: userId !== null,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
