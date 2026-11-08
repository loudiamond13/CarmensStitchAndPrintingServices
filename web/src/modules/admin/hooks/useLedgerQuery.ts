// A person's ledger page (MONEY-02, D-41). The ledger is live, so it is read again on every visit and nothing is served from a fresh
// cache. It lives under the staff-money root, so every money write that invalidates that root reads it again. Changing the page
// keeps the rows on screen while the next page loads, but never another person's rows.
import { useQuery } from '@tanstack/react-query';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import {
  moneyService,
  parseLedgerPage,
  type LedgerPage,
  type LedgerQuery,
} from '@/modules/admin/services/moneyService';

/** The key of one person's ledger page: the staff-money root, `ledger`, the person, then the page's parameters. */
export const ledgerKey = (userId: string, params: LedgerQuery) => [...staffMoneyKey, 'ledger', userId, params] as const;

const PERSON_AT = 2;

export function useLedgerQuery(userId: string, params: LedgerQuery) {
  return useQuery({
    queryKey: ledgerKey(userId, params),
    // An answer with a figure or a kind the browser cannot trust fails the query, so the card shows its alert, not a wrong row.
    queryFn: async ({ signal }): Promise<LedgerPage> =>
      parseLedgerPage(await moneyService.ledger(userId, params, signal)),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[PERSON_AT] === userId ? previous : undefined,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
