// The caller's own money on hand (MONEY-02, D-13). The figure is live, so it is read again on every visit and nothing is served
// from a fresh cache. Every staff-money query lives under the root key, so one invalidation reaches them all.
import { useQuery } from '@tanstack/react-query';
import { moneyService, parseMyMoney, type MyMoney } from '@/modules/admin/services/moneyService';

/** What a money card reads of the query, so a card never owns the request and a test can hand it plain values. */
export interface MyMoneyCardQuery {
  readonly data: MyMoney | undefined;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => unknown;
}

/** The root key of every staff-money query: invalidate it after any money write. */
export const staffMoneyKey = ['staff-money'] as const;
export const myMoneyKey = ['staff-money', 'me'] as const;

export function useMyMoneyQuery() {
  return useQuery({
    queryKey: myMoneyKey,
    // An answer with a figure the browser cannot trust fails the query, so the card shows its alert instead of a wrong balance.
    queryFn: async ({ signal }) => parseMyMoney(await moneyService.me(signal)),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
