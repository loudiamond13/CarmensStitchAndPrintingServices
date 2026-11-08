// Records one transfer or one hand-over through useSubmission (MONEY-04, SEC-06, WEB-09): one Idempotency-Key per submission, one request
// in flight, the same key for a retry of the same body after a failure that may have run, and a new key for a corrected body. A saved
// transfer says the sender's new balance from the server's answer ("You now have ₱6,450.00 on hand."); a saved hand-over says what the
// leaver now holds ("Jomar Santos now holds ₱0.00."). Either reads the money, transfer and dashboard answers again (D-13), after a failure
// that may have saved as well. A body with `fromUserId` is a hand-over (D-17).
import { useToast } from '@/components/feedback';
import { isHttpError } from '@/core/api/errors';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import { useRefreshMoney } from '@/modules/admin/hooks/useRefreshMoney';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { HandoverBody, TransferBody } from '@/modules/admin/moneySchemas';
import { moneyService, type TransferSavedResponse } from '@/modules/admin/services/moneyService';
import { formatPeso } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';
import { toFiniteFigure } from '@/utils/toFiniteFigure';

const TOAST = MONEY_COPY.transfer.toast;
const HANDOVER_TOAST = MONEY_COPY.handover.toast;

export interface TransferActionOptions {
  /** The transfer was recorded and the toast is up: close the window. */
  onSaved?: ((saved: TransferSavedResponse) => void) | undefined;
  /** The submission failed; show it where the person is looking. */
  onFailure?: ((copy: ErrorCopy, error: unknown) => void) | undefined;
  /** The leaver's name, for the hand-over toast. */
  leaverName?: string | undefined;
  /** Sends the body instead of the server (the Component Showcase's demo windows, which must make no request). */
  send?: ((key: string, body: TransferBody | HandoverBody) => Promise<TransferSavedResponse>) | undefined;
}

function isHandover(body: TransferBody | HandoverBody): body is HandoverBody {
  return 'fromUserId' in body;
}

export function useTransferAction({
  onSaved,
  onFailure,
  leaverName,
  send,
}: TransferActionOptions = {}): SubmissionState<TransferBody | HandoverBody, TransferSavedResponse> {
  const toast = useToast();
  const refreshMoney = useRefreshMoney();
  return useSubmission<TransferBody | HandoverBody, TransferSavedResponse>(
    (key, body) => {
      if (send !== undefined) return send(key, body);
      return isHandover(body) ? moneyService.handover(body, key) : moneyService.create(body, key);
    },
    {
      onSuccess: (saved, body) => {
        void refreshMoney();
        // The balance is the server's. A figure the browser cannot read leaves the second line out rather than say a wrong one.
        const balance = toFiniteFigure(saved.senderBalance);
        if (isHandover(body)) {
          toast.show({
            tone: 'success',
            title: HANDOVER_TOAST.title,
            ...(balance === null || leaverName === undefined
              ? {}
              : { message: HANDOVER_TOAST.message(leaverName, formatPeso(balance)) }),
          });
        } else {
          toast.show({
            tone: 'success',
            title: TOAST.title,
            ...(balance === null ? {} : { message: TOAST.message(formatPeso(balance)) }),
          });
        }
        onSaved?.(saved);
      },
      onFailure: (copy, error) => {
        // A failure that may have saved (a server error, a timeout, no answer) leaves the money answers old, so they are read again.
        if (!isHttpError(error) || error.kind !== 'http' || error.status >= 500 || error.status === 408) {
          void refreshMoney();
        }
        onFailure?.(copy, error);
      },
    },
  );
}
