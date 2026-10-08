// Toast (App. D.3 "Feedback", CSPS-UI-SPEC.md §6.5), converted to utilities (D-33) with the App. D.3 props and markup:
// the tone icon, the bold title over an optional message, an optional action and the "Dismiss" icon button. Danger is
// role="alert", the others role="status". The looks are in feedback.recipe.ts; each tone is one complete literal.
// The timing rules (D-04, D-31 O-5, O-7) live in the toast queue and ToastProvider, not here.
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/ui/brand';
import {
  iconButtonClasses,
  toastClasses,
  toastEdgeToneClasses,
  toastIconClasses,
  toastIconToneClasses,
  toastMessageClasses,
  toastTextClasses,
} from './feedback.recipe';

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';

export interface ToastProps {
  tone?: ToastTone | undefined;
  title: string;
  message?: ReactNode;
  /** Shows the "Dismiss" button. */
  onClose?: (() => void) | undefined;
  action?: ReactNode;
}

const TOAST_ICON = {
  success: 'circle-check',
  danger: 'triangle-alert',
  info: 'info',
  warning: 'triangle-alert',
} as const satisfies Record<ToastTone, IconName>;

export function Toast({ tone = 'success', title, message, onClose, action }: ToastProps) {
  return (
    <div className={clsx(toastClasses, toastEdgeToneClasses[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className={clsx(toastIconClasses, toastIconToneClasses[tone])}>
        <Icon name={TOAST_ICON[tone]} size={20} />
      </span>
      <div className={toastTextClasses}>
        <strong>{title}</strong>
        {Boolean(message) && <span className={toastMessageClasses}>{message}</span>}
      </div>
      {action}
      {onClose !== undefined && (
        <button type="button" className={iconButtonClasses} onClick={onClose} aria-label="Dismiss">
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}
