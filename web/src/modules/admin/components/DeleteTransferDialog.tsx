// SPEC-GAP: DeleteTransferDialog (UI-SPEC T2; D-23, D-29, D-35, MONEY-06; plan 10-20). The simple confirm before a Manager deletes a
// transfer: it says what is deleted and what that does, with Cancel focused first and no reason to type (D-29). The DELETE sends the
// row's version as a query parameter (D-23). On success the dialog closes, the toast shows and the money answers are read again; the
// host hears about it first (`onDone`) so it can choose where focus goes. A transfer can be recorded again, so this is not final.
import { ConfirmDialog } from '@/components/overlays';
import { useTransferDeletion } from '@/modules/admin/hooks/useTransferDeletion';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { TransferTarget } from '@/modules/admin/services/moneyService';
import { formatPeso } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';

const COPY = MONEY_COPY.deleteTransfer;

export interface DeleteTransferDialogProps {
  transfer: TransferTarget;
  open: boolean;
  /** Cancel, Esc or the scrim, and a finished delete. */
  onClose: () => void;
  /** The transfer is gone from the counted list (deleted by this press, or already deleted): the host decides where focus goes. */
  onDone: (transfer: TransferTarget) => void;
}

export function DeleteTransferDialog({ transfer, open, onClose, onDone }: DeleteTransferDialogProps) {
  const { deleteTransfer } = useTransferDeletion();

  const confirm = async () => {
    const outcome = await deleteTransfer.submit({ id: transfer.id, version: transfer.version });
    if (outcome.ok) {
      onDone(transfer);
      onClose();
    }
    return outcome;
  };

  return (
    <ConfirmDialog
      open={open}
      title={COPY.title}
      message={COPY.message(
        formatPeso(transfer.amount),
        transfer.from.name,
        transfer.to.name,
        formatCalendarDate(transfer.date) ?? transfer.date,
      )}
      cancelLabel={COPY.cancel}
      confirmLabel={COPY.confirm}
      confirmIcon="trash-2"
      pendingLabel={COPY.pending}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
