// Select (App. D.3 "Forms", CSPS-UI-SPEC.md §6.3), converted to utilities (D-33) with the same props API and markup: the
// label, the control box with a native <select> (an optional empty-value placeholder option first, then the string or
// {value, label} options) and the chevron-down overlay, then one message: the error, or else the hint. Keyboard and
// screen-reader behaviour are the native select's. The select gets `aria-invalid` with an error.
// SPEC-DEVIATION: A11Y-01 App. D.3 gave the message no id and the select no aria-describedby, so the hint and the error
// were never announced with it; as in Field, the message has the `{id}-msg` id and the select names it. No element or
// text changes (attributes are not compared). Also as in Field, a caller id names the select (the label follows it).
import clsx from 'clsx';
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from '@/components/brand';
import {
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  labelClasses,
  messageClasses,
  selectChevronClasses,
  selectOptionClasses,
} from './field.recipe';

export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
}

export function Select({ label, options, placeholder, error, hint, className, id, ...rest }: SelectProps) {
  const fid = useId();
  const iid = id !== undefined && id !== '' ? id : fid;
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);
  const messageId = `${iid}-msg`;
  return (
    <div className={clsx(fieldClasses, className)}>
      {Boolean(label) && (
        <label className={labelClasses} htmlFor={iid}>
          {label}
        </label>
      )}
      <div className={fieldControlClasses}>
        <select
          id={iid}
          className={fieldInputClasses({ select: true })}
          aria-invalid={invalid || undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          {...rest}
        >
          {placeholder !== undefined && placeholder !== '' && (
            <option value="" className={selectOptionClasses}>
              {placeholder}
            </option>
          )}
          {options.map((option) => {
            const optionValue = typeof option === 'string' ? option : option.value;
            return (
              <option key={optionValue} value={optionValue} className={selectOptionClasses}>
                {typeof option === 'string' ? option : option.label}
              </option>
            );
          })}
        </select>
        <Icon name="chevron-down" size={18} className={selectChevronClasses} />
      </div>
      {hasMessage && (
        <p id={messageId} className={messageClasses({ error: invalid })}>
          {invalid ? error : hint}
        </p>
      )}
    </div>
  );
}
