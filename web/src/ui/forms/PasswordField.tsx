// RED stub (plan 02-20 Task 2): renders nothing yet.
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
  label?: string;
  showStrength?: boolean;
  error?: string;
  hint?: ReactNode;
  value?: string;
  defaultValue?: string;
}

export function PasswordField(_props: PasswordFieldProps) {
  return null;
}
