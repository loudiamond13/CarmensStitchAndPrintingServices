// Deleting a transfer through useSubmission (MONEY-06, D-23, D-29, WEB-09): one request in flight, a double press sends one. A finished
// delete toasts and reads the money answers again (transfers, ledger, balances, my money and the dashboard, D-13). The Delete Transfer
// dialog (and, with plan 10-20 task 3, the permanent remove) calls it and decides what else follows.
import { useToast } from '@/components/feedback';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import { useRefreshMoney } from '@/modules/admin/hooks/useRefreshMoney';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { moneyService } from '@/modules/admin/services/moneyService';

const DELETED = MONEY_COPY.deleteTransfer.toast;

/** The transfer to delete: its id and the version the Manager last saw. */
export interface DeleteTransferArgs {
  readonly id: string;
  readonly version: string;
}

export interface TransferDeletion {
  readonly deleteTransfer: SubmissionState<DeleteTransferArgs, void>;
}

export function useTransferDeletion(): TransferDeletion {
  const toast = useToast();
  const refreshMoney = useRefreshMoney();
  const deleteTransfer = useSubmission(
    (_key, target: DeleteTransferArgs) => moneyService.deleteTransfer(target.id, target.version),
    {
      onSuccess: () => {
        toast.show({ tone: 'success', title: DELETED.title, message: DELETED.message });
        void refreshMoney();
      },
    },
  );
  return { deleteTransfer };
}
