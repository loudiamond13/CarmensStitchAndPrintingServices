// SPEC-GAP: MoneyInput (UI-SPEC "SPEC-GAP Primitive Specs" → MoneyInput; ORD-09, WEB-06, PERF-03, D-09).
// `Field` with the ₱ prefix and the decimal keypad. The box only ever holds money text (web/src/lib/format.ts): at
// most 9 integer digits and 2 decimals, ASCII digits only, no sign and no grouping.
//   - A keystroke that would break that is ignored: the value stays as it was, so React puts the box back.
//   - A paste loses its grouping commas and spaces first (`normalizePastedMoney`), then goes in at the caret or over
//     the selection; a paste that is still not money text there is ignored.
//   - On blur a non-empty value pads to 2 decimals (`padMoneyOnBlur`: "5000" → "5000.00"); empty stays empty.
//   - Nothing else ever changes what was typed: no rounding and no grouping while editing.
// The value is a string; convert it with `moneyTextToCentavos` (exact integer centavos, never a binary float) after
// `moneyInputError` says it is acceptable. Type, height and the invalid look come from Field; the component adds only
// the `align="right"` look for item rows (App. E.9).
import clsx from 'clsx';
import type { ChangeEvent, ClipboardEvent, FocusEvent, InputHTMLAttributes, ReactNode } from 'react';
import { isMoneyText, normalizePastedMoney, padMoneyOnBlur } from '@/lib/format';
import { Field } from '@/ui/forms';
import { ENTRY_COPY } from './copy';
import { moneyAlignRightClasses } from './entry.recipe';

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onPaste'
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'prefix'
  | 'children'
  | 'className'
  | 'id'
  | 'required'
> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Shown under the box (with aria-invalid) only when the caller passes it, after the first submit. */
  error?: string;
  required?: boolean;
  /** Layout glue on the field wrapper (margin, width, grid placement); never a restyle. */
  className?: string;
  id?: string;
  /** The money text, for example "1250.50". */
  value: string;
  /** The new money text after an accepted keystroke, paste or blur padding. */
  onChange: (value: string) => void;
  /** `right` for item rows (App. E.9); forms keep the default left alignment (App. E.10). */
  align?: 'left' | 'right' | undefined;
}

/**
 * The UI-SPEC MoneyInput error for the value, or null when it is acceptable. "" and a lone "." are empty: "Enter an
 * amount." when the field is required, else fine. Text that is not money text gets "Enter an amount like 1250.50 …".
 */
export function moneyInputError(value: string, { required = false }: { required?: boolean } = {}): string | null {
  if (value === '' || value === '.') {
    return required ? ENTRY_COPY.money.required : null;
  }
  return isMoneyText(value) ? null : ENTRY_COPY.money.invalid;
}

export function MoneyInput({ value, onChange, onBlur, align = 'left', className, ...rest }: MoneyInputProps) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (isMoneyText(next)) {
      onChange(next);
    }
  };
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = normalizePastedMoney(event.clipboardData.getData('text'));
    if (pasted === '') {
      return;
    }
    const box = event.currentTarget;
    const start = box.selectionStart ?? value.length;
    const end = box.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${pasted}${value.slice(end)}`;
    if (isMoneyText(next)) {
      onChange(next);
    }
  };
  const blur = (event: FocusEvent<HTMLInputElement>) => {
    const padded = padMoneyOnBlur(value);
    if (padded !== value) {
      onChange(padded);
    }
    onBlur?.(event);
  };
  return (
    <Field
      {...rest}
      className={clsx(align === 'right' && moneyAlignRightClasses, className)}
      prefix={ENTRY_COPY.money.prefix}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={change}
      onPaste={paste}
      onBlur={blur}
    />
  );
}
