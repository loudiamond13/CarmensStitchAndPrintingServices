// The people the Transfer Money window may offer in To (D-19, D-49, D-56). It is read again every time the window opens, because who
// can receive money changes (a person leaves, a leaver is paid off). The answer holds names and status words only.
import { useQuery } from '@tanstack/react-query';
import { moneyService, toTransferRecipients } from '@/modules/admin/services/moneyService';

/** The root key of every transfer query: invalidate it after any transfer write. */
export const moneyTransfersKey = ['money-transfers'] as const;
export const transferRecipientsKey = ['money-transfers', 'recipients'] as const;

export function useTransferRecipientsQuery(enabled: boolean) {
  return useQuery({
    queryKey: transferRecipientsKey,
    queryFn: async ({ signal }) => toTransferRecipients(await moneyService.recipients(signal)),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
