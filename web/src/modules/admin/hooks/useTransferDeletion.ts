// Deleting a transfer through useSubmission (MONEY-06, D-23, D-29, SEC-07, WEB-09): one request in flight, a double press sends one.
// A finished delete toasts and reads the money answers again (transfers, ledger, balances, my money and the dashboard, D-13).
//   - 409 (the transfer changed since the Manager saw it) is a failure the dialog shows as its alert line; the lists are read again so
//     the Manager sees the latest.
//   - 404 (someone got there first) is not a failure: the transfer is gone either way, so the info toast says so, the lists are read
//     again and the dialog closes like a success.
// The Delete Transfer dialog (and, with plan 10-20 task 3, the permanent remove) calls it and decides what else follows.
import { useToast } from '@/components/feedback';
import { isHttpError } from '@/core/api/errors';
import { useSubmission, type SubmissionOutcome } from '@/lib/forms/useSubmission';
import { useRefreshMoney } from '@/modules/admin/hooks/useRefreshMoney';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { moneyService } from '@/modules/admin/services/moneyService';

const DELETED = MONEY_COPY.deleteTransfer.toast;
const ALREADY = MONEY_COPY.deleteTransfer.alreadyDeleted;

/** The transfer to delete: its id and the version the Manager last saw. */
export interface DeleteTransferArgs {
  readonly id: string;
  readonly version: string;
}

/** How a delete ended: it happened, it was already done by someone else, or it failed (the dialog shows the failure). */
export type DeletionResult =
  | { readonly status: 'done' }
  | { readonly status: 'gone' }
  | { readonly status: 'failed'; readonly outcome: SubmissionOutcome<void> };

export interface TransferDeletion {
  readonly deleteTransfer: (target: DeleteTransferArgs) => Promise<DeletionResult>;
}

/** The HTTP status of a failure the server answered, or null for anything else. */
function statusOf(error: unknown): number | null {
  return isHttpError(error) && error.kind === 'http' ? error.status : null;
}

export function useTransferDeletion(): TransferDeletion {
  const toast = useToast();
  const refreshMoney = useRefreshMoney();
  const submission = useSubmission(
    (_key, target: DeleteTransferArgs) => moneyService.deleteTransfer(target.id, target.version),
    {
      onSuccess: () => {
        toast.show({ tone: 'success', title: DELETED.title, message: DELETED.message });
        void refreshMoney();
      },
    },
  );

  const deleteTransfer = async (target: DeleteTransferArgs): Promise<DeletionResult> => {
    const outcome = await submission.submit(target);
    if (outcome.ok) return { status: 'done' };
    const status = statusOf(outcome.error);
    if (status === 404) {
      toast.show({ tone: 'info', title: ALREADY });
      void refreshMoney();
      return { status: 'gone' };
    }
    if (status === 409) {
      void refreshMoney();
    }
    return { status: 'failed', outcome };
  };

  return { deleteTransfer };
}
