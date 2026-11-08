// Compile-only stub for the RED commit (plan 10-20). The dialog arrives with the GREEN commit.
import type { TransferTarget } from '@/modules/admin/services/moneyService';

export interface DeleteTransferDialogProps {
  transfer: TransferTarget;
  open: boolean;
  /** Cancel, Esc or the scrim, and a finished delete. */
  onClose: () => void;
  /** The transfer is gone from the counted list (deleted by this press, or already deleted): the host decides where focus goes. */
  onDone: (transfer: TransferTarget) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-only stub, replaced in GREEN
export function DeleteTransferDialog(_props: DeleteTransferDialogProps) {
  return null;
}
