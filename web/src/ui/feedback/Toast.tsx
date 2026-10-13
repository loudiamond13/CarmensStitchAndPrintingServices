// Toast (App. D.3 "Feedback", CSPS-UI-SPEC.md §6.5), converted to utilities (D-33) with the App. D.3 props and markup:
// the tone icon, the bold title over an optional message, an optional action and the "Dismiss" icon button. Danger is
// role="alert", the others role="status". The looks are in feedback.recipe.ts; each tone is one complete literal.
// The timing rules (D-04, D-31 O-5, O-7) live in the toast queue and ToastProvider, not here.
// SPEC-DEVIATION: UI-WR-04 `announce={false}` drops the role. ToastProvider passes it because its always-mounted layer
// is already the polite live region (D-31 O-5), and a role="status" or role="alert" toast inside it is a live region
// nested in a live region, which NVDA and JAWS read twice. A Toast on its own keeps the App. D.3 role. Attribute only.
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
  /** The toast's own live role (default true); false inside a live region that already announces it. */
  announce?: boolean | undefined;
}

const TOAST_ICON = {
  success: 'circle-check',
  danger: 'triangle-alert',
  info: 'info',
  warning: 'triangle-alert',
} as const satisfies Record<ToastTone, IconName>;

export function Toast({ tone = 'success', title, message, onClose, action, announce = true }: ToastProps) {
  const role = tone === 'danger' ? 'alert' : 'status';
  return (
    <div className={clsx(toastClasses, toastEdgeToneClasses[tone])} role={announce ? role : undefined}>
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
