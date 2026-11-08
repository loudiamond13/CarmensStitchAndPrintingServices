// Compile-only stub for the RED commit (plan 10-20). The table arrives with the GREEN commit.
import type { TransferPage, TransferTarget } from '@/modules/admin/services/moneyService';

export interface TransfersTableProps {
  page: TransferPage | undefined;
  pending?: boolean | undefined;
  refetching?: boolean | undefined;
  failed?: boolean | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  captionId?: string | undefined;
  onDelete: (target: TransferTarget) => void;
  onRemove: (target: TransferTarget) => void;
  register?: ((id: string, button: HTMLButtonElement | null) => void) | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-only stub, replaced in GREEN
export function TransfersTable(_props: TransfersTableProps) {
  return null;
}
