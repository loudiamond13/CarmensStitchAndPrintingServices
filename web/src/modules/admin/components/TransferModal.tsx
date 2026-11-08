// RED stub: the transfer window arrives in the next commit.
import type { RefObject } from 'react';

export interface TransferModalProps {
  open?: boolean;
  mode: 'transfer';
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null> | undefined;
}

export function TransferModal(props: TransferModalProps) {
  void props;
  return null;
}
