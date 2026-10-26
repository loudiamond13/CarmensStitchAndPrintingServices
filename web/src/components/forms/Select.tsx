// Select (App. D.3 "Forms", CSPS-UI-SPEC.md §6.3), converted to utilities (D-33) with the same props API and markup: the
// label, the control box with a native <select> (an optional empty-value placeholder option first, then the string or
// {value, label} options) and the chevron-down overlay, then one message: the error, or else the hint. Keyboard and
// screen-reader behaviour are the native select's. The select gets `aria-invalid` with an error. A required select marks
// its label with an aria-hidden " *" as Field does.
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
  requiredClasses,
  selectChevronClasses,
  selectOptionClasses,
} from './field.recipe';

/** `group` puts the option under a native optgroup; consecutive options with the same group share one. */
export type SelectOption = string | { value: string; label: string; group?: string };

type OptionObject = Exclude<SelectOption, string>;

interface OptionChunk {
  group: string | undefined;
  items: readonly OptionObject[];
}

/** Splits the options into runs of the same group (undefined for ungrouped), keeping their order. */
function chunkOptions(options: readonly SelectOption[]): OptionChunk[] {
  const chunks: { group: string | undefined; items: OptionObject[] }[] = [];
  for (const option of options) {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    const last = chunks.at(-1);
    if (last !== undefined && last.group === item.group) {
      last.items.push(item);
    } else {
      chunks.push({ group: item.group, items: [item] });
    }
  }
  return chunks;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
}

export function Select({ label, options, placeholder, error, hint, className, id, required, ...rest }: SelectProps) {
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
          {required === true && (
            <span className={requiredClasses} aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
      )}
      <div className={fieldControlClasses}>
        <select
          id={iid}
          className={fieldInputClasses({ select: true })}
          aria-invalid={invalid || undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          required={required}
          {...rest}
        >
          {placeholder !== undefined && placeholder !== '' && (
            <option value="" className={selectOptionClasses}>
              {placeholder}
            </option>
          )}
          {chunkOptions(options).map((chunk, index) => {
            const items = chunk.items.map((item) => (
              <option key={item.value} value={item.value} className={selectOptionClasses}>
                {item.label}
              </option>
            ));
            return chunk.group === undefined ? (
              items
            ) : (
              <optgroup key={`${chunk.group}-${String(index)}`} label={chunk.group} className={selectOptionClasses}>
                {items}
              </optgroup>
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
