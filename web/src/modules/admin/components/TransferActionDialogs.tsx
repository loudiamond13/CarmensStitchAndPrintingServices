// The confirms behind the Manager's transfer row actions (plan 10-20), drawn once by the card that owns the rows (the Transfers card or
// the ledger card), outside the table. useTransferRowActions holds which one is open.
import { DeleteTransferDialog } from '@/modules/admin/components/DeleteTransferDialog';
import { RemoveTransferDialog } from '@/modules/admin/components/RemoveTransferDialog';
import type { TransferTarget } from '@/modules/admin/services/moneyService';

/** A confirm that is open, or was last open (kept while its close plays). */
interface PendingTransfer {
  target: TransferTarget;
  open: boolean;
}

export interface TransferActionDialogsProps {
  deleting: PendingTransfer | null;
  onCloseDelete: () => void;
  onDeleteDone: (target: TransferTarget) => void;
  removing: PendingTransfer | null;
  onCloseRemove: () => void;
  onRemoveDone: (target: TransferTarget) => void;
}

export function TransferActionDialogs({
  deleting,
  onCloseDelete,
  onDeleteDone,
  removing,
  onCloseRemove,
  onRemoveDone,
}: TransferActionDialogsProps) {
  return (
    <>
      {deleting !== null && (
        <DeleteTransferDialog
          key={deleting.target.id}
          transfer={deleting.target}
          open={deleting.open}
          onClose={onCloseDelete}
          onDone={onDeleteDone}
        />
      )}
      {removing !== null && (
        <RemoveTransferDialog
          key={removing.target.id}
          transfer={removing.target}
          open={removing.open}
          onClose={onCloseRemove}
          onDone={onRemoveDone}
        />
      )}
    </>
  );
}
