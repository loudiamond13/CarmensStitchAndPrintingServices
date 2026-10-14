// PasswordField (App. D.3 "Forms", CSPS-UI-SPEC.md §6.3), the WEB-06 "PasswordInput", converted to utilities (D-33) with
// the same props API, markup and copy: the label, the control box with the password box and the reveal toggle
// (aria-label switching between the two copy strings below, aria-pressed, an 18px eye / eye-off icon), the optional
// strength meter (four aria-hidden bars and a polite label: Weak / Fair / Good / Strong from passwordStrength, or the
// empty hint), then one message: the error with a 14px triangle-alert, or else the hint.
// The bar and label tones come from recipe maps keyed by the score (no class name is built at run time).
// T-02-50: the reveal is an explicit toggle, autocomplete passes through, and the value is never logged.
// SPEC-DEVIATION: A11Y-01 App. D.3 always gave the box the generated id and spread `id` and `className` with the other
// attributes onto the box, so a caller id left the label pointing nowhere and a caller className replaced the box look.
// As in Field and Select, a caller id names the box (the label follows it) and className is layout glue on the field.
import clsx from 'clsx';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { passwordStrength } from '@/utils/csps';
import { Icon } from '@/components/brand';
import {
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  labelClasses,
  messageClasses,
  strengthBarClasses,
  strengthBarsClasses,
  strengthClasses,
  strengthLabelClasses,
  suffixButtonClasses,
} from './field.recipe';

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
  label?: string;
  showStrength?: boolean;
  error?: string;
  hint?: ReactNode;
  value?: string;
  defaultValue?: string;
}

const BAR_INDEXES = [1, 2, 3, 4] as const;

export function PasswordField({
  label = 'Password',
  showStrength = false,
  value,
  defaultValue,
  onChange,
  error,
  hint,
  id,
  className,
  ...rest
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value ?? inner;
  const strength = passwordStrength(current);
  const fid = useId();
  const iid = id !== undefined && id !== '' ? id : fid;
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);
  const messageId = `${iid}-msg`;
  return (
    <div className={clsx(fieldClasses, className)}>
      <label className={labelClasses} htmlFor={iid}>
        {label}
      </label>
      <div className={fieldControlClasses}>
        <input
          id={iid}
          className={fieldInputClasses({ suffix: true })}
          type={shown ? 'text' : 'password'}
          value={current}
          aria-invalid={invalid || undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          onChange={(event) => {
            setInner(event.target.value);
            onChange?.(event);
          }}
          {...rest}
        />
        <button
          type="button"
          className={suffixButtonClasses}
          onClick={() => {
            setShown(!shown);
          }}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {showStrength && (
        <div className={strengthClasses} aria-live="polite">
          <div className={strengthBarsClasses} aria-hidden="true">
            {BAR_INDEXES.map((index) => (
              <span key={index} className={strengthBarClasses(strength.score, index <= strength.score)} />
            ))}
          </div>
          <span className={strengthLabelClasses(strength.score)}>
            {current === '' ? 'Use 8+ characters with a number and a symbol' : strength.label}
          </span>
        </div>
      )}
      {hasMessage && (
        <p id={messageId} className={messageClasses({ error: invalid })}>
          {invalid && <Icon name="triangle-alert" size={14} />}
          {invalid ? error : hint}
        </p>
      )}
    </div>
  );
}
