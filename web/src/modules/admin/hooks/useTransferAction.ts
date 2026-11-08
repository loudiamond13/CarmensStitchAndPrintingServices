// Records one transfer through useSubmission (MONEY-04, SEC-06, WEB-09): one Idempotency-Key per submission, one request in flight, the
// same key for a retry of the same body after a failure that may have run, and a new key for a corrected body. A saved transfer says
// the sender's new balance from the server's answer and reads the money, transfer and dashboard answers again (D-13).
import { useToast } from '@/components/feedback';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import { useRefreshMoney } from '@/modules/admin/hooks/useRefreshMoney';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { TransferBody } from '@/modules/admin/moneySchemas';
import { moneyService, type TransferSavedResponse } from '@/modules/admin/services/moneyService';
import { formatPeso } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';
import { toFiniteFigure } from '@/utils/toFiniteFigure';

const TOAST = MONEY_COPY.transfer.toast;

export interface TransferActionOptions {
  /** The transfer was recorded and the toast is up: close the window. */
  onSaved?: ((saved: TransferSavedResponse) => void) | undefined;
  /** The submission failed; show it where the person is looking. */
  onFailure?: ((copy: ErrorCopy, error: unknown) => void) | undefined;
}

export function useTransferAction({ onSaved, onFailure }: TransferActionOptions = {}): SubmissionState<
  TransferBody,
  TransferSavedResponse
> {
  const toast = useToast();
  const refreshMoney = useRefreshMoney();
  return useSubmission<TransferBody, TransferSavedResponse>((key, body) => moneyService.create(body, key), {
    onSuccess: (saved) => {
      void refreshMoney();
      // The balance is the server's. A figure the browser cannot read leaves the second line out rather than say a wrong one.
      const balance = toFiniteFigure(saved.senderBalance);
      toast.show({
        tone: 'success',
        title: TOAST.title,
        ...(balance === null ? {} : { message: TOAST.message(formatPeso(balance)) }),
      });
      onSaved?.(saved);
    },
    ...(onFailure === undefined ? {} : { onFailure }),
  });
}
