// RED placeholder (plan 02-12 Task 2): the real OtpInput replaces this in the GREEN commit.
import type { ReactNode } from 'react';
import { OTP_INPUT_COPY } from './copy';

export interface OtpInputProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  id?: string;
}

export function OtpInput({ label = OTP_INPUT_COPY.legend }: OtpInputProps) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <input key={i} aria-label={OTP_INPUT_COPY.digit(i, 6)} />
      ))}
    </fieldset>
  );
}

export function validateOtp(code: string): string | null {
  return code === '' ? null : null;
}
