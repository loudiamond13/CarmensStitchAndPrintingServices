// SPEC-GAP: Checkbox (02-UI-SPEC SPEC-GAP "Checkbox"; WEB-06, A11Y-01, D-03).
// The spec section 8.2 markup, label.s-check > input[type=checkbox], so the label text is the accessible name and a
// click anywhere on the label toggles the native box. Its look (2px --ink border, orange fill and --on-accent tick when
// checked, focus ring) is the D-03 rule in overrides.css; this component adds no style of its own. A hint or a caller
// error follows the label as a .csp-msg paragraph, linked with aria-describedby.
import { clsx } from 'clsx';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/ui';

export interface CheckboxProps {
  label: ReactNode;
  /** Controlled state; pass it with onChange. Leave both checked and defaultChecked out for an unticked box. */
  checked?: boolean;
  defaultChecked?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** The new checked state after a click or Space. */
  onChange?: (checked: boolean) => void;
  required?: boolean;
  id?: string;
  /** On the label.s-check wrapper. */
  className?: string;
  hint?: ReactNode;
  /** Shown instead of the hint (with aria-invalid) only when the caller passes it. */
  error?: string;
}

export function Checkbox({
  label,
  checked,
  defaultChecked,
  name,
  value,
  disabled,
  onChange,
  required,
  id,
  className,
  hint,
  error,
}: CheckboxProps) {
  const fid = useId();
  const iid = id ?? fid;
  const msgId = error || hint ? iid + '-msg' : undefined;
  return (
    <>
      <label className={clsx('s-check', className)}>
        <input
          id={iid}
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={msgId}
          onChange={(event) => {
            onChange?.(event.target.checked);
          }}
        />
        {label}
        {required && (
          <span className="csp-req" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {msgId && (
        <p id={msgId} className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>
          {error && <Icon name="triangle-alert" size={14} />}
          {error || hint}
        </p>
      )}
    </>
  );
}
