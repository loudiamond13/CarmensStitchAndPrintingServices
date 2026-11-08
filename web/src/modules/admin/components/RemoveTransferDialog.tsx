// Compile-only stub for the RED commit (plan 10-20). The dialog arrives with the GREEN commit.
import type { TransferTarget } from '@/modules/admin/services/moneyService';

export interface RemoveTransferDialogProps {
  transfer: TransferTarget;
  open: boolean;
  /** Cancel, Esc or the scrim, and a finished remove. */
  onClose: () => void;
  /** The transfer is gone (removed by this press, or already removed): the host decides where focus goes. */
  onDone: (transfer: TransferTarget) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-only stub, replaced in GREEN
export function RemoveTransferDialog(_props: RemoveTransferDialogProps) {
  return null;
}
