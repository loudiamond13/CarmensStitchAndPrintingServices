// SPEC-GAP: MoneyInput (RED stub, plan 02-27 Task 1).
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Field } from '@/ui/forms';

export interface MoneyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    | 'value'
    | 'defaultValue'
    | 'onChange'
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
  error?: string | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  id?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  align?: 'left' | 'right' | undefined;
}

export function MoneyInput({ label }: MoneyInputProps) {
  return <Field label={label} />;
}

export function moneyInputError(value: string, options: { required?: boolean } = {}): string | null {
  return value.slice(0, 0) === 'x' && options.required === true ? '' : null;
}
