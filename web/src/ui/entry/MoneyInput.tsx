// SPEC-GAP: MoneyInput (UI-SPEC "SPEC-GAP Primitive Specs" → MoneyInput; ORD-09, WEB-06, PERF-03, D-09).
// `Field` with the ₱ prefix and the decimal keypad. The box only ever holds money text (web/src/lib/format.ts): at
// most 9 integer digits and 2 decimals, ASCII digits only, no sign and no grouping.
//   - A keystroke that would break that is ignored: the value stays as it was, so React puts the box back.
//   - A paste loses a leading peso sign or "PHP" (UI-WR-09) and its grouping commas and spaces first
//     (`normalizePastedMoney`), then goes in at the caret or over the selection. A blank clipboard changes nothing.
//     SPEC-DEVIATION: D-41 R2-18 (owner, 2026-10-13) a paste that is still not money text there (including one that
//     cleans down to nothing, such as "PHP" alone) is refused with a word: the value stays, and the field shows the
//     amount hint (ENTRY_COPY.money.invalid) in the error look (`aria-invalid`) and announces it politely. The hint is
//     fixed copy and never echoes the pasted text. This closes code-review warning UI-WR-09.
//     Code review WR-02, WR-03 and WR-04 (02-REVIEW-d41.md):
//       - the hint is tied to the refused value: any later value (typed, pasted, or set by the caller through a reset
//         or an auto-fill) clears it, and a later return to the old value does not bring it back. Only the blur
//         padding of that same value ("7" → "7.00") keeps it, because the padding is this component's own rewrite of
//         the same amount (WR-02);
//       - a caller's non-empty `error` wins, and then the status node announces nothing, so it never says something
//         that is not shown. An empty `error` counts as no error, as it does in Field (WR-03);
//       - a read-only or disabled box ignores a paste: the default is not prevented, the caller's value never changes
//         and nothing is marked invalid (WR-04).
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
  // D-41 R2-18 / WR-02: the box value at the moment a paste was refused, or null. The refusal stands while the value is
  // that text or its blur padding; any other value clears it (an accepted keystroke or paste does so directly).
  const [refusedAt, setRefusedAt] = useState<string | null>(null);
  const refused = refusedAt !== null && (value === refusedAt || value === padMoneyOnBlur(refusedAt));
  if (refusedAt !== null && !refused) {
    // React's "adjust state when a prop changes" pattern: a caller-set value (a reset, a "Pay full balance" fill)
    // drops the stale refusal during render, so a later return to the old value cannot bring the hint back.
    setRefusedAt(null);
  }
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (isMoneyText(next)) {
      setRefusedAt(null);
      onChange(next);
    }
  };
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    // WR-04: a read-only or disabled box keeps the browser's own (empty) paste default and its caller's value.
    if (event.currentTarget.readOnly || event.currentTarget.disabled) {
      return;
    }
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
      setRefusedAt(null);
      onChange(next);
    } else {
      setRefusedAt(value);
    }
  };
  const blur = (event: FocusEvent<HTMLInputElement>) => {
    const padded = padMoneyOnBlur(value);
    if (padded !== value) {
      onChange(padded);
    }
    onBlur?.(event);
  };
  // WR-03: an empty `error` is no error, as in Field (`Boolean(error)`).
  const callerError = error !== undefined && error !== '' ? error : undefined;
  const pasteHint = refused ? ENTRY_COPY.money.invalid : undefined;
  const shownError = callerError ?? pasteHint;
  // WR-03: the live region announces the hint only when it is the message on screen.
  const announced = callerError === undefined ? pasteHint : undefined;
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
        {announced}
      </span>
    </>
  );
}
