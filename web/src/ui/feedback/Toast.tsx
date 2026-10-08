// RED stub (plan 02-21 Task 2): the converted Toast arrives in the GREEN commit.
import type { ReactNode } from 'react';

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';

export interface ToastProps {
  tone?: ToastTone | undefined;
  title: string;
  message?: ReactNode;
  onClose?: (() => void) | undefined;
  action?: ReactNode;
}

export function Toast(_props: ToastProps) {
  return <div />;
}
