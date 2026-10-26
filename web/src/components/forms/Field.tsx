// Field (App. D.3 "Forms", CSPS-UI-SPEC.md §6.3; the PRD Input and TextArea), converted to utilities (D-33) with the same
// props API and markup: the label (required → an aria-hidden " *"), the control box with an optional aria-hidden
// prefix and the text box (`input`, or `textarea` when `multiline`), then one message: the error (with a 14px
// triangle-alert) or else the hint. The box gets `aria-invalid` with an error and `aria-describedby` naming the
// message. Nothing is invalid until the caller passes an `error` (no validation before the first submit).
// The look comes from field.recipe.ts; `.is-invalid` is keyed off the box's own aria-invalid, `.has-prefix` and
// `.is-multiline` are recipe options. `beside` puts extra content on the box's row, outside it. App. D.3's native attribute passthrough is kept (UI-SPEC: Field accepts all native
// input props), so the memo is pinned by an equal-props re-render test (L-13). `className` is layout glue on the field.
import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon } from '@/components/brand';
import {
  fieldBesideBoxClasses,
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  fieldRowClasses,
  labelClasses,
  messageClasses,
  prefixClasses,
  requiredClasses,
} from './field.recipe';

interface FieldBase {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Shown before the box, e.g. "₱" or "%" (hidden from assistive technology; the label names the box). */
  prefix?: string;
  required?: boolean;
  /** Shown beside the box, outside it, on the same row. */
  beside?: ReactNode;
  /** Layout glue on the field (margin, width, grid placement); never a restyle. */
  className?: string;
  id?: string;
}

export type FieldProps =
  | (FieldBase & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>)
  | (FieldBase & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'>);

export function Field(props: FieldProps) {
  const { label, hint, error, prefix, required, beside, multiline = false, id, className, ...rest } = props;
  const fid = useId();
  // As App. D.3 (`id || fid`): an empty id counts as none.
  const iid = id !== undefined && id !== '' ? id : fid;
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);
  const messageId = `${iid}-msg`;
  const hasPrefix = prefix !== undefined && prefix !== '';
  const common = {
    id: iid,
    className: fieldInputClasses({ multiline, prefix: hasPrefix }),
    'aria-invalid': invalid || undefined,
    'aria-describedby': hasMessage ? messageId : undefined,
    required,
  };
  const box = (
    <div className={beside === undefined ? fieldControlClasses : clsx(fieldControlClasses, fieldBesideBoxClasses)}>
      {hasPrefix && (
        <span className={prefixClasses} aria-hidden="true">
          {prefix}
        </span>
      )}
      {multiline ? (
        <textarea {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
  return (
    <div className={clsx(fieldClasses, className)}>
      {Boolean(label) && (
        <label className={labelClasses} htmlFor={iid}>
          {label}
          {required === true && (
            <span className={requiredClasses} aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
      )}
      {beside === undefined ? (
        box
      ) : (
        <div className={fieldRowClasses}>
          {box}
          {beside}
        </div>
      )}
      {hasMessage && (
        <p id={messageId} className={messageClasses({ error: invalid })}>
          {invalid && <Icon name="triangle-alert" size={14} />}
          {invalid ? error : hint}
        </p>
      )}
    </div>
  );
}
