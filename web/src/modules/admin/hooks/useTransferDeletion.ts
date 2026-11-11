// Deleting a transfer, and removing a deleted one for good, through useSubmission (MONEY-06, D-23 to D-29, SEC-07, WEB-09): one request
// in flight, a double press sends one. A finished delete or remove toasts and reads the money answers again (transfers, ledger,
// balances, my money and the dashboard, D-13).
//   - 409 on a delete (the transfer changed since the Manager saw it) is a failure the dialog shows as its alert line; the lists are
//     read again so the Manager sees the latest.
//   - 404 (someone got there first) is not a failure: the transfer is gone either way, so the info toast says so, the lists are read
//     again and the dialog closes like a success.
// The two dialogs call it and decide what else follows (closing, and where focus goes).
import { useToast } from '@/components/feedback';
import { isHttpError } from '@/core/api/errors';
import { useSubmission, type SubmissionOutcome } from '@/lib/forms/useSubmission';
import { useRefreshMoney } from '@/modules/admin/hooks/useRefreshMoney';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { moneyService } from '@/modules/admin/services/moneyService';

const DELETED = MONEY_COPY.deleteTransfer;
const REMOVED = MONEY_COPY.removeTransfer;

/** The transfer to delete: its id and the version the Manager last saw. */
export interface DeleteTransferArgs {
  readonly id: string;
  readonly version: string;
}

/** The deleted transfer to remove for good. The remove acts on the latest state, so there is no version. */
export interface RemoveTransferArgs {
  readonly id: string;
}

/** How a delete or remove ended: it happened, it was already done by someone else, or it failed (the dialog shows the failure). */
export type DeletionResult =
  | { readonly status: 'done' }
  | { readonly status: 'gone' }
  | { readonly status: 'failed'; readonly outcome: SubmissionOutcome<void> };

export interface TransferDeletion {
  readonly deleteTransfer: (target: DeleteTransferArgs) => Promise<DeletionResult>;
  readonly removeTransfer: (target: RemoveTransferArgs) => Promise<DeletionResult>;
}

/** The HTTP status of a failure the server answered, or null for anything else. */
function statusOf(error: unknown): number | null {
  return isHttpError(error) && error.kind === 'http' ? error.status : null;
}

export function useTransferDeletion(): TransferDeletion {
  const toast = useToast();
  const refreshMoney = useRefreshMoney();
  const deletion = useSubmission(
    (_key, target: DeleteTransferArgs) => moneyService.deleteTransfer(target.id, target.version),
    {
      onSuccess: () => {
        toast.show({ tone: 'success', title: DELETED.toast.title, message: DELETED.toast.message });
        void refreshMoney();
      },
    },
  );
  const removal = useSubmission((_key, target: RemoveTransferArgs) => moneyService.removeTransfer(target.id), {
    onSuccess: () => {
      toast.show({ tone: 'success', title: REMOVED.toast.title, message: REMOVED.toast.message });
      void refreshMoney();
    },
  });

  /** Turns an outcome into a result: a 404 is "gone" with its info toast, and a 409 reads the lists again. */
  const settle = async (outcome: SubmissionOutcome<void>, goneTitle: string): Promise<DeletionResult> => {
    if (outcome.ok) return { status: 'done' };
    const status = statusOf(outcome.error);
    if (status === 404) {
      toast.show({ tone: 'info', title: goneTitle });
      void refreshMoney();
      return { status: 'gone' };
    }
    if (status === 409) {
      // The failure shows after the lists are read, so the next try already carries the fresh version.
      await refreshMoney();
    }
    return { status: 'failed', outcome };
  };

  return {
    deleteTransfer: async (target) => settle(await deletion.submit(target), DELETED.alreadyDeleted),
    removeTransfer: async (target) => settle(await removal.submit(target), REMOVED.alreadyRemoved),
  };
}
