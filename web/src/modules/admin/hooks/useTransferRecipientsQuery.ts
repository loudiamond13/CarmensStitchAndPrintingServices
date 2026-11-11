// The people the Transfer Money and Hand Over windows may offer in To (D-19, D-49, D-56). It is read again every time a window opens,
// because who can receive money changes (a person leaves, a leaver is paid off). The answer holds names, status words and the signed-in
// person's mark only; each window picks its own list from it (pickTransferRecipients, pickHandoverRecipients).
import { useQuery } from '@tanstack/react-query';
import { moneyService, toTransferPeople } from '@/modules/admin/services/moneyService';

/** The root key of every transfer query: invalidate it after any transfer write. */
export const moneyTransfersKey = ['money-transfers'] as const;
export const transferRecipientsKey = ['money-transfers', 'recipients'] as const;

export function useTransferRecipientsQuery(enabled: boolean) {
  return useQuery({
    queryKey: transferRecipientsKey,
    queryFn: async ({ signal }) => toTransferPeople(await moneyService.recipients(signal)),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
