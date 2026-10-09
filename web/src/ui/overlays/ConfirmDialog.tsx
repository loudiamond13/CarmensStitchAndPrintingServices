// RED stub (plan 02-22 Task 2).
import type { ReactNode } from 'react';
import type { CascadeCounts } from '@/lib/csps';

export interface ConfirmDialogProps {
  title?: string;
  message?: ReactNode;
  counts?: CascadeCounts;
  confirmText?: string;
  confirmLabel?: string;
  onConfirm?: () => unknown;
  onCancel?: () => void;
  inline?: boolean;
  loading?: boolean;
}

export function ConfirmDialog(_props: ConfirmDialogProps) {
  return <div />;
}
