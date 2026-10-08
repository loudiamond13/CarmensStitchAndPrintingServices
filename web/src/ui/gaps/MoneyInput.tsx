// SPEC-GAP: MoneyInput (02-UI-SPEC SPEC-GAP "MoneyInput"; ORD-09, WEB-06, PERF-03, D-09).
// `Field` with the ₱ prefix and the decimal keypad. The box only ever holds a money string: at most 9 integer digits and
// 2 decimals, no sign and no grouping. A keystroke or paste that would break that is ignored; a paste loses its grouping
// commas and spaces first. On blur a non-empty value pads to 2 decimals. The value stays a string, and the only
// conversion to money is `toCentavos` from @/lib/csps (exact integer centavos, no binary float).
import type { ChangeEvent, FocusEvent, InputHTMLAttributes, ReactNode } from 'react';
import { toCentavos } from '@/lib/csps';
import { Field } from '@/ui';
import { MONEY_INPUT_COPY } from './copy';

/** What the box may hold while editing: 0-9 integer digits, then an optional point with 0-2 decimals. */
const MONEY_PATTERN = /^\d{0,9}(?:\.\d{0,2})?$/;

/** Grouping a paste may carry: commas and any kind of space (incl. no-break and thin spaces). */
const GROUPING = /[\s,]/g;

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'prefix'
  | 'children'
  | 'required'
  | 'className'
  | 'id'
> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Shown under the box (with aria-invalid) only when the caller passes it, after the first submit. */
  error?: string;
  required?: boolean;
  /** On the `.csp-field` wrapper. Item rows pass `text-right` to right-align the amount (App. E.9). */
  className?: string;
  id?: string;
  /** The typed money string, for example "1250.50". Convert it with `toCentavos`. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

/** "5000" → "5000.00", "5." → "5.00", ".5" → "0.50", "." → "", "" → ""; a non-money string is returned unchanged. */
export function normalizeMoneyOnBlur(value: string): string {
  if (!MONEY_PATTERN.test(value)) {
    return value;
  }
  const point = value.indexOf('.');
  const whole = point < 0 ? value : value.slice(0, point);
  const cents = point < 0 ? '' : value.slice(point + 1);
  if (whole === '' && cents === '') {
    return '';
  }
  return `${whole === '' ? '0' : whole}.${cents.padEnd(2, '0')}`;
}

/** The UI-SPEC MoneyInput error copy for the value, or null when it is acceptable. */
export function validateMoneyInput(value: string, { required = false }: { required?: boolean } = {}): string | null {
  if (value === '') {
    return required ? MONEY_INPUT_COPY.required : null;
  }
  return toCentavos(value) === null ? MONEY_INPUT_COPY.invalid : null;
}

export function MoneyInput({ value, onChange, onBlur, ...rest }: MoneyInputProps) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.value.replace(GROUPING, '');
    // An ignored change leaves `value` as it was, so React puts the box back to it.
    if (candidate !== value && MONEY_PATTERN.test(candidate)) {
      onChange(candidate);
    }
  };
  const blur = (event: FocusEvent<HTMLInputElement>) => {
    const padded = normalizeMoneyOnBlur(value);
    if (padded !== value) {
      onChange(padded);
    }
    onBlur?.(event);
  };
  return (
    <Field
      {...rest}
      prefix={MONEY_INPUT_COPY.prefix}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={change}
      onBlur={blur}
    />
  );
}
