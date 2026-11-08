// SPEC-GAP: RemoveTransferDialog (UI-SPEC T3; D-24 to D-28, MONEY-06; plan 10-20). The stronger confirm before a Manager removes a deleted
// transfer for good: a danger details box names the record, its dates and who deleted it, and says that balances do not change and a
// copy stays in the audit log (D-24, D-25). Cancel is focused first and there is nothing to type: the danger look and the details are
// what make it stronger (D-26). One row at a time, and no restore exists anywhere (D-27, D-28).
//   - The remove acts on the latest state, so it sends no version. A 404 means someone else removed it first: the dialog closes with an
//     info toast. The host hears about either (`onDone`) so it can choose where focus goes.
import { ConfirmDialog } from '@/components/overlays';
import { removeDetailsClasses, removeNoteClasses, removeRecordClasses } from '@/modules/admin/components/money.recipe';
import { useTransferDeletion } from '@/modules/admin/hooks/useTransferDeletion';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { TransferTarget } from '@/modules/admin/services/moneyService';
import { formatPeso } from '@/utils/csps';
import { formatBusinessDate, formatCalendarDate } from '@/utils/format';

const COPY = MONEY_COPY.removeTransfer;

export interface RemoveTransferDialogProps {
  transfer: TransferTarget;
  open: boolean;
  /** Cancel, Esc or the scrim, and a finished remove. */
  onClose: () => void;
  /** The transfer is gone (removed by this press, or already removed): the host decides where focus goes. */
  onDone: (transfer: TransferTarget) => void;
}

/** "Dated Oct 6, 2026 · Deleted by Carmen Reyes on Oct 8, 2026"; the deleted-by part is left out when the record names no one. */
function datedLine(transfer: TransferTarget): string {
  const dated = COPY.dated(formatCalendarDate(transfer.date) ?? transfer.date);
  if (transfer.deletedBy === null) return dated;
  const when = transfer.deletedAtUtc === null ? null : formatBusinessDate(transfer.deletedAtUtc);
  return `${dated}${COPY.joiner}${COPY.deletedBy(transfer.deletedBy.name, when)}`;
}

export function RemoveTransferDialog({ transfer, open, onClose, onDone }: RemoveTransferDialogProps) {
  const { removeTransfer } = useTransferDeletion();

  const confirm = async () => {
    const result = await removeTransfer({ id: transfer.id });
    if (result.status === 'failed') return result.outcome;
    onDone(transfer);
    onClose();
    return undefined;
  };

  return <RemoveTransferView transfer={transfer} open={open} onConfirm={confirm} onClose={onClose} />;
}

export interface RemoveTransferViewProps {
  transfer: TransferTarget;
  open: boolean;
  onConfirm: () => unknown;
  onClose: () => void;
}

/** The dialog as the screen draws it, from plain values: the Component Showcase hands it demo data and a confirm that only closes. */
export function RemoveTransferView({ transfer, open, onConfirm, onClose }: RemoveTransferViewProps) {
  return (
    <ConfirmDialog
      open={open}
      title={COPY.title}
      message={
        <>
          {COPY.message}
          <span className={removeDetailsClasses}>
            <span className={removeRecordClasses}>
              {COPY.record(formatPeso(transfer.amount), transfer.from.name, transfer.to.name)}
            </span>
            <span className={removeNoteClasses}>{datedLine(transfer)}</span>
            <span className={removeNoteClasses}>{COPY.note}</span>
          </span>
        </>
      }
      cancelLabel={COPY.cancel}
      confirmLabel={COPY.confirm}
      confirmIcon="eraser"
      pendingLabel={COPY.pending}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
