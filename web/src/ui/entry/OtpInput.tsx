// SPEC-GAP: OtpInput (UI-SPEC "SPEC-GAP Primitive Specs" → OtpInput; WEB-06, A11Y-02, PERF-03, T-02-61).
// Six one-digit boxes in a borderless fieldset whose legend has the label look. Each box is the field-control look
// holding a field-input text box, so the 16px digit type (no iOS zoom) and the 44px height come from field.recipe.ts;
// the component adds only the row, the box widths and centred tabular digits (entry.recipe.ts).
//   - Keys go by event.key: a digit fills the box and moves on; Backspace clears the box, or in an empty box moves
//     back and clears that one; Delete clears; ←/→, Home and End move. Other printable keys are ignored; shortcuts
//     and Tab are left to the browser.
//   - Only ASCII 0-9 count (full-width or other-script digits are ignored), as the server parses codes.
//   - Paste is always allowed (PRD §12 accessible authentication): the digits of the pasted text fill from the focused
//     box, then focus goes to the next empty box (or the last). A value written straight into a box (the first box's
//     autofill, a virtual keyboard) goes through the same fill.
//   - onComplete(code) fires each time an edit leaves all six boxes filled. Nothing validates before a submit: the
//     caller checks the code with `otpInputError` and passes the error, which marks every box invalid.
// Codes are never logged.
import clsx from 'clsx';
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '@/ui/brand';
import { fieldControlClasses, fieldInputClasses, labelClasses, messageClasses } from '@/ui/forms';
import { fieldClasses, requiredClasses } from '@/ui/forms/field.recipe';
import { ENTRY_COPY } from './copy';
import { otpBoxClasses, otpBoxesClasses, otpDigitClasses, otpGroupClasses, otpLegendClasses } from './entry.recipe';

const LENGTH = 6;
const BOXES = Array.from({ length: LENGTH }, (_, index) => index);
const DIGIT = /^[0-9]$/;
const NON_DIGITS = /[^0-9]/g;
const CODE = /^[0-9]{6}$/;
/** The autofill hint for the first box only (T-02-61). */
const FIRST_BOX_AUTOCOMPLETE = 'one-time-code';

export interface OtpInputProps {
  /** The legend; defaults to "Sign-in code". */
  label?: ReactNode;
  /** Under the boxes; defaults to "Enter the 6-digit code we emailed you.". An empty hint shows no message. */
  hint?: ReactNode;
  /** Shown instead of the hint, with aria-invalid on every box, only when the caller passes it. */
  error?: string;
  required?: boolean;
  /** Controlled boxes: one character per box, a space for an empty box ("12 4" fills boxes 1, 2 and 4). */
  value?: string;
  /** The starting boxes when the component keeps its own state (no `value`). */
  defaultValue?: string;
  /** The boxes in the `value` format after each edit (trailing empty boxes dropped). */
  onChange?: (code: string) => void;
  /** The six-digit code, each time an edit leaves all six boxes filled. */
  onComplete?: (code: string) => void;
  /** Given to the first box, so a caller can focus the group or point a link at it. */
  id?: string;
}

/** "Enter all 6 digits." unless the code is exactly six ASCII digits. */
export function otpInputError(code: string): string | null {
  return CODE.test(code) ? null : ENTRY_COPY.otp.incomplete;
}

function toSlots(code: string): string[] {
  return BOXES.map((index) => {
    const char = code.charAt(index);
    return DIGIT.test(char) ? char : '';
  });
}

function toCode(slots: readonly string[]): string {
  return slots
    .map((slot) => (slot === '' ? ' ' : slot))
    .join('')
    .trimEnd();
}

export function OtpInput({
  label = ENTRY_COPY.otp.legend,
  hint = ENTRY_COPY.otp.hint,
  error,
  required,
  value,
  defaultValue,
  onChange,
  onComplete,
  id,
}: OtpInputProps) {
  const [inner, setInner] = useState(defaultValue ?? '');
  const group = useRef<HTMLFieldSetElement>(null);
  const messageId = `${useId()}-msg`;
  const slots = toSlots(value ?? inner);
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);

  const focusBox = (index: number) => {
    const boxes = group.current?.querySelectorAll<HTMLInputElement>('input');
    boxes?.item(Math.min(Math.max(index, 0), LENGTH - 1)).focus();
  };

  const commit = (next: readonly string[]) => {
    const code = toCode(next);
    setInner(code);
    onChange?.(code);
    if (next.every((slot) => slot !== '')) {
      onComplete?.(code);
    }
  };

  const setSlot = (index: number, digit: string) => {
    commit(slots.map((slot, at) => (at === index ? digit : slot)));
  };

  /** Puts the digits into the boxes from `index` on, then focuses the next empty box after them (or the last box). */
  const fill = (index: number, digits: string) => {
    const chars = digits.slice(0, LENGTH - index).split('');
    const next = slots.map((slot, at) => chars[at - index] ?? slot);
    commit(next);
    const after = next.findIndex((slot, at) => at >= index + chars.length && slot === '');
    focusBox(after < 0 ? LENGTH - 1 : after);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    const { key } = event;
    if (DIGIT.test(key)) {
      event.preventDefault();
      setSlot(index, key);
      focusBox(index + 1);
    } else if (key === 'Backspace') {
      event.preventDefault();
      if (slots[index] !== '') {
        setSlot(index, '');
      } else if (index > 0) {
        setSlot(index - 1, '');
        focusBox(index - 1);
      }
    } else if (key === 'Delete') {
      event.preventDefault();
      setSlot(index, '');
    } else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
      event.preventDefault();
      const moves = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: LENGTH - 1 };
      focusBox(moves[key]);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // A letter, a space, a symbol or a non-ASCII digit: not part of a code.
      event.preventDefault();
    }
  };

  const change = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const raw = event.target.value;
    const digits = raw.replace(NON_DIGITS, '');
    if (raw === '') {
      setSlot(index, '');
    } else if (digits !== '') {
      fill(index, digits);
    }
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(NON_DIGITS, '');
    if (digits !== '') {
      fill(index, digits);
    }
  };

  return (
    <fieldset ref={group} className={clsx(fieldClasses, otpGroupClasses)}>
      <legend className={clsx(labelClasses, otpLegendClasses)}>
        {label}
        {required === true && (
          <span className={requiredClasses} aria-hidden="true">
            {' *'}
          </span>
        )}
      </legend>
      <div className={otpBoxesClasses}>
        {BOXES.map((index) => (
          // The boxes never reorder, so the position is the identity.
          <div key={index} className={clsx(fieldControlClasses, otpBoxClasses)}>
            <input
              className={clsx(fieldInputClasses(), otpDigitClasses)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={index === 0 ? FIRST_BOX_AUTOCOMPLETE : 'off'}
              aria-label={ENTRY_COPY.otp.digit(index + 1, LENGTH)}
              aria-invalid={invalid || undefined}
              aria-describedby={hasMessage ? messageId : undefined}
              required={required}
              id={index === 0 ? id : undefined}
              value={slots[index]}
              onKeyDown={(event) => {
                keyDown(event, index);
              }}
              onChange={(event) => {
                change(event, index);
              }}
              onPaste={(event) => {
                paste(event, index);
              }}
              onFocus={(event) => {
                // A new digit replaces the old one, even where the browser keeps maxLength on direct input.
                event.currentTarget.select();
              }}
            />
          </div>
        ))}
      </div>
      {hasMessage && (
        <p id={messageId} className={messageClasses({ error: invalid })}>
          {invalid && <Icon name="triangle-alert" size={14} />}
          {invalid ? error : hint}
        </p>
      )}
    </fieldset>
  );
}
