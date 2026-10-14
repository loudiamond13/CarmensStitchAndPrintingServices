// SPEC-GAP: Checkbox (UI-SPEC "SPEC-GAP Primitive Specs" → Checkbox, "Color" → D-03; WEB-06, A11Y-01).
// The spec §8.2 markup, a label with the `.s-check` look wrapping a native checkbox, so the label text is the accessible
// name and a click anywhere on the label toggles the box. The box takes the D-03 look (2px --ink border, --accent fill
// and an --on-accent tick when checked, the focus ring). The tick is an aria-hidden sibling span in the same grid cell,
// shown by `peer-checked:` (D-33, the planner's mechanism, assumption A12). A hint, or a caller error with
// aria-invalid, follows the label as a message linked with aria-describedby.
import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import { Icon } from '@/ui/brand';
import { messageClasses } from '@/ui/forms';
import { requiredClasses } from '@/ui/forms/field.recipe';
import { checkCellClasses, checkInputClasses, checkLabelClasses, checkTickClasses } from './entry.recipe';

export interface CheckboxProps {
  /** The visible text, which is also the box's accessible name. */
  label: ReactNode;
  /** Controlled state; pass it with onChange. Leave checked and defaultChecked out for an unticked box. */
  checked?: boolean;
  defaultChecked?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** The new checked state after a click or Space. */
  onChange?: (checked: boolean) => void;
  required?: boolean;
  id?: string;
  /** Layout glue on the label (margin, placement); never a restyle. */
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
  const iid = id !== undefined && id !== '' ? id : fid;
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);
  const messageId = `${iid}-msg`;
  return (
    <>
      <label className={clsx(checkLabelClasses, className)}>
        <span className={checkCellClasses}>
          <input
            id={iid}
            type="checkbox"
            className={checkInputClasses}
            name={name}
            value={value}
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={hasMessage ? messageId : undefined}
            onChange={(event) => {
              onChange?.(event.target.checked);
            }}
          />
          <span className={checkTickClasses} aria-hidden="true" />
        </span>
        {label}
        {required === true && (
          <span className={requiredClasses} aria-hidden="true">
            {' *'}
          </span>
        )}
      </label>
      {hasMessage && (
        <p id={messageId} className={messageClasses({ error: invalid })}>
          {invalid && <Icon name="triangle-alert" size={14} />}
          {invalid ? error : hint}
        </p>
      )}
    </>
  );
}
