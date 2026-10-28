// SPEC-GAP: DateInput (UI-SPEC "SPEC-GAP Primitive Specs" → DateInput; first needed by the Audit Log range filter).
// A native date input in the field-control look (44px, 16px text), with `min`, `max` and a YYYY-MM-DD value in business
// time. The app's calendar icon sits over the browser's own indicator, which stays the click target (D-63), so the
// browser's picker and keyboard are the native ones. The range and format rules are the caller's zod schema (OR-3); its
// message goes in `error` and shows under the field. Markup as Select: label, picker box, then one message.
import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '@/components/brand';
import {
  dateIconClasses,
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  labelClasses,
  messageClasses,
  pickerControlClasses,
  pickerIconClasses,
  requiredClasses,
} from './field.recipe';

export interface DateInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'prefix'
> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** YYYY-MM-DD, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest date, YYYY-MM-DD. */
  min?: string;
  /** Latest date, YYYY-MM-DD. */
  max?: string;
}

export function DateInput({
  label,
  hint,
  error,
  value,
  onChange,
  min,
  max,
  required,
  id,
  className,
  ...rest
}: DateInputProps) {
  const fid = useId();
  // As Field: an empty id counts as none.
  const iid = id !== undefined && id !== '' ? id : fid;
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);
  const messageId = `${iid}-msg`;
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
      <div className={clsx(fieldControlClasses, pickerControlClasses)}>
        <input
          id={iid}
          className={fieldInputClasses({ date: true })}
          aria-invalid={invalid || undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          required={required}
          {...rest}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            onChange(event.currentTarget.value);
          }}
        />
        <Icon name="calendar" size={18} className={clsx(pickerIconClasses, dateIconClasses)} />
      </div>
      {hasMessage && (
        <p id={messageId} className={messageClasses({ error: invalid })}>
          {invalid && <Icon name="triangle-alert" size={14} />}
          {invalid ? error : hint}
        </p>
      )}
    </div>
  );
}
