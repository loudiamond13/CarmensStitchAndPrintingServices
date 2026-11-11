// Every transfer between staff, one page at a time, for a Manager only (MONEY-03, D-48). The browser never asks as an Admin: `enabled` is
// the role check, and the server answers 403 anyway. It is live, so it is read again on every visit; it lives under the money-transfers
// root, so every transfer write that invalidates that root reads it again. Changing the page keeps the rows on screen while the next
// page loads.
import { useQuery } from '@tanstack/react-query';
import { moneyTransfersKey } from '@/modules/admin/hooks/useTransferRecipientsQuery';
import {
  moneyService,
  parseTransferPage,
  type TransferListQuery,
  type TransferPage,
} from '@/modules/admin/services/moneyService';

/** The key of one page of the Transfers tab: the money-transfers root, `list`, then the page's parameters. */
export const transfersKey = (params: TransferListQuery) => [...moneyTransfersKey, 'list', params] as const;

export function useTransfersQuery(params: TransferListQuery, enabled: boolean) {
  return useQuery({
    queryKey: transfersKey(params),
    // An answer with a figure the browser cannot trust fails the query, so the tab shows its alert, not a wrong row.
    queryFn: async ({ signal }): Promise<TransferPage> =>
      parseTransferPage(await moneyService.transfers(params, signal)),
    // A row-less answer (a page past the last) is never kept as the placeholder: it would read as an empty list.
    placeholderData: (previous) => ((previous?.rows.length ?? 0) > 0 ? previous : undefined),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
