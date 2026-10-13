// SPEC-GAP: MoneyInput (UI-SPEC "SPEC-GAP Primitive Specs" → MoneyInput; ORD-09, WEB-06, PERF-03, D-09).
// `Field` with the ₱ prefix and the decimal keypad. The box only ever holds money text (web/src/lib/format.ts): at
// most 9 integer digits and 2 decimals, ASCII digits only, no sign and no grouping.
//   - A keystroke that would break that is ignored: the value stays as it was, so React puts the box back.
//   - A paste loses a leading peso sign or "PHP" (UI-WR-09) and its grouping commas and spaces first
//     (`normalizePastedMoney`), then goes in at the caret or over the selection. A blank clipboard changes nothing.
//     SPEC-DEVIATION: D-41 R2-18 (owner, 2026-10-13) a paste that is still not money text there (including one that
//     cleans down to nothing, such as "PHP" alone) is refused with a word: the value stays, and the field shows the
//     amount hint (ENTRY_COPY.money.invalid) in the error look (`aria-invalid`) and announces it politely, until the
//     next accepted keystroke or paste. A caller's `error` always wins. The hint is fixed copy and never echoes the
//     pasted text. This closes code-review warning UI-WR-09.
//   - On blur a non-empty value pads to 2 decimals (`padMoneyOnBlur`: "5000" → "5000.00"); empty stays empty.
//   - Nothing else ever changes what was typed: no rounding and no grouping while editing.
// The value is a string; convert it with `moneyTextToCentavos` (exact integer centavos, never a binary float) after
// `moneyInputError` says it is acceptable. Type, height and the invalid look come from Field; the component adds only
// the `align="right"` look for item rows (App. E.9).
import clsx from 'clsx';
import {
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { isMoneyText, normalizePastedMoney, padMoneyOnBlur } from '@/lib/format';
import { Field } from '@/ui/forms';
import { srOnlyClasses } from '@/ui/layout/layout.recipe';
import { ENTRY_COPY } from './copy';
import { moneyAlignRightClasses } from './entry.recipe';

/**
 * SPEC-DEVIATION: UI-WR-09 the UI-SPEC paste rule strips grouping only, but every amount the app shows is `formatPeso`
 * text ("₱4,327.50"), so a copied balance must paste too. One leading "₱" or "PHP" (any case) and the spaces around it
 * go; a sign after it ("₱-5") is still rejected, and so is anything else around the amount.
 */
const PESO_PREFIX = /^\s*(?:₱|PHP)\s*/i;

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

export function MoneyInput({ value, onChange, onBlur, align = 'left', className, error, ...rest }: MoneyInputProps) {
  // D-41 R2-18: set by a refused paste, cleared by the next accepted keystroke or paste (never by the blur padding).
  const [refused, setRefused] = useState(false);
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (isMoneyText(next)) {
      setRefused(false);
      onChange(next);
    }
  };
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    if (text.trim() === '') {
      return;
    }
    const pasted = normalizePastedMoney(text.replace(PESO_PREFIX, ''));
    const box = event.currentTarget;
    const start = box.selectionStart ?? value.length;
    const end = box.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${pasted}${value.slice(end)}`;
    if (pasted !== '' && isMoneyText(next)) {
      setRefused(false);
      onChange(next);
    } else {
      setRefused(true);
    }
  };
  const blur = (event: FocusEvent<HTMLInputElement>) => {
    const padded = padMoneyOnBlur(value);
    if (padded !== value) {
      onChange(padded);
    }
    onBlur?.(event);
  };
  const pasteHint = refused ? ENTRY_COPY.money.invalid : undefined;
  const shownError = error ?? pasteHint;
  return (
    <>
      <Field
        {...rest}
        {...(shownError === undefined ? {} : { error: shownError })}
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
      {/* WCAG 4.1.3: always mounted, so the refusal is announced politely without moving focus. */}
      <span role="status" aria-live="polite" className={srOnlyClasses}>
        {pasteHint}
      </span>
    </>
  );
}
