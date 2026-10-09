// RED stub (plan 02-22 Task 1).
import type { ReactNode, RefObject } from 'react';
import type { ModalVariant } from './overlays.recipe';

export interface ModalProps {
  open?: boolean;
  title: string;
  description?: ReactNode;
  onClose?: (() => void) | undefined;
  footer?: ReactNode;
  variant?: ModalVariant;
  inline?: boolean;
  loading?: boolean;
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  children?: ReactNode;
}

export function Modal(_props: ModalProps) {
  return <div />;
}
