// RED stub (plan 02-21 Task 3): ToastProvider and useToast arrive in the GREEN commit.
import type { ReactNode } from 'react';
import type { ToastInput, ToastQueue } from './toastQueue';

export type { ToastItem } from './toastQueue';

export interface ToastApi {
  show(toast: ToastInput): number;
  dismiss(id: number): void;
}

export interface ToastProviderProps {
  children?: ReactNode;
  queue?: ToastQueue | undefined;
}

export function ToastProvider({ children }: ToastProviderProps) {
  return <>{children}</>;
}

export function useToast(): ToastApi {
  return { show: () => 0, dismiss: () => undefined };
}
