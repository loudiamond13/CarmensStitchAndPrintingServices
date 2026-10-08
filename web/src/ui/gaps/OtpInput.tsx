// SPEC-GAP: OtpInput (02-UI-SPEC SPEC-GAP "OtpInput"; WEB-06, A11Y-01, PERF-03, T-02-34).
// Six one-digit boxes in a borderless fieldset. Each box is a .csp-control > input.csp-input, so the 16px digit type
// and the 44px height come from App. B. Keys are handled by event.key: a digit fills the box and moves on, Backspace
// clears (or, in an empty box, moves back and clears that box), Delete clears, the arrows, Home and End move.
// Letters and symbols are ignored, shortcuts and Tab are left to the browser, and paste is always allowed: the digits
// of the pasted text fill from the focused box. A virtual keyboard or one-time-code autofill that writes the value
// directly goes through the same fill. onComplete(code) fires whenever an edit leaves all six boxes filled.
import { clsx } from 'clsx';
import { useId, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import { Icon } from '@/ui';
import { OTP_INPUT_COPY } from './copy';

const LENGTH = 6;
const DIGIT = /^\d$/;
const NON_DIGITS = /\D/g;

export interface OtpInputProps {
  /** The legend; defaults to "Sign-in code". */
  label?: ReactNode;
  /** Under the boxes; defaults to "Enter the 6-digit code we emailed you.". */
  hint?: ReactNode;
  /** Shown instead of the hint (with aria-invalid on every box) only when the caller passes it. */
  error?: string;
  required?: boolean;
  /** One character per box, a space for an empty box ("12 4" fills boxes 1, 2 and 4). Trailing spaces are dropped. */
  value?: string;
  /** The starting boxes when the component keeps its own state (no `value`). */
  defaultValue?: string;
  /** The boxes in the `value` format after each edit. Check it with `validateOtp` before submitting. */
  onChange?: (code: string) => void;
  /** The six-digit code, each time an edit leaves all six boxes filled. */
  onComplete?: (code: string) => void;
  /** Given to the first box, so a caller can focus the group or point a link at it. */
  id?: string;
}

/** 'Enter all 6 digits.' unless the code is exactly six digits. */
export function validateOtp(code: string): string | null {
  return /^\d{6}$/.test(code) ? null : OTP_INPUT_COPY.incomplete;
}

function toSlots(code: string): string[] {
  return Array.from({ length: LENGTH }, (_, index) => {
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
  label = OTP_INPUT_COPY.legend,
  hint = OTP_INPUT_COPY.hint,
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
  const msgId = useId() + '-msg';
  const slots = toSlots(value ?? inner);

  const focusBox = (index: number) => {
    group.current
      ?.querySelectorAll<HTMLInputElement>('input')
      .item(Math.min(Math.max(index, 0), LENGTH - 1))
      .focus();
  };

  const commit = (next: string[]) => {
    const code = toCode(next);
    setInner(code);
    onChange?.(code);
    if (next.every((slot) => slot !== '')) {
      onComplete?.(code);
    }
  };

  const setSlot = (index: number, digit: string) => {
    commit(slots.map((slot, i) => (i === index ? digit : slot)));
  };

  /** Puts the digits into the boxes from `index` on, then focuses the next empty box after them (or the last box). */
  const fill = (index: number, digits: string) => {
    const chars = digits.slice(0, LENGTH - index).split('');
    const next = [...slots];
    chars.forEach((char, offset) => {
      next[index + offset] = char;
    });
    commit(next);
    const after = next.findIndex((slot, i) => i >= index + chars.length && slot === '');
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
      const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: LENGTH - 1 }[key];
      focusBox(target);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // A letter, a space or a symbol: not part of a code.
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
    <fieldset ref={group} className={clsx('csp-field', 'csp-otp', error && 'is-invalid')}>
      <legend className="csp-label">
        {label}
        {required && (
          <span className="csp-req" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </legend>
      <div className="csp-otp-boxes">
        {slots.map((digit, index) => (
          // The boxes never reorder, so the position is the identity.
          <div key={index} className={clsx('csp-control', error && 'is-invalid')}>
            <input
              className="csp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={OTP_INPUT_COPY.digit(index + 1, LENGTH)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || hint ? msgId : undefined}
              required={required}
              id={index === 0 ? id : undefined}
              value={digit}
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
      {(error || hint) && (
        <p id={msgId} className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>
          {error && <Icon name="triangle-alert" size={14} />}
          {error || hint}
        </p>
      )}
    </fieldset>
  );
}
