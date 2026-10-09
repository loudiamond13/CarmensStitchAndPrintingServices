// SPEC-GAP: OtpInput (RED stub, plan 02-27 Task 2).
import type { ReactNode } from 'react';

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

export function OtpInput({ label }: OtpInputProps) {
  return (
    <fieldset>
      <legend>{label}</legend>
    </fieldset>
  );
}

export function otpInputError(code: string): string | null {
  return code.slice(0, 0) === 'x' ? '' : null;
}
