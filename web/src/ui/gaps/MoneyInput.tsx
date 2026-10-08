// RED placeholder (plan 02-12 Task 1): the real MoneyInput replaces this in the GREEN commit.
import type { FocusEvent, InputHTMLAttributes, ReactNode } from 'react';
import { Field } from '@/ui';

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'prefix'
  | 'children'
  | 'required'
  | 'className'
  | 'id'
> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

export function MoneyInput({ value, onChange, onBlur, ...rest }: MoneyInputProps) {
  return (
    <Field
      {...rest}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onBlur={onBlur}
    />
  );
}

export function normalizeMoneyOnBlur(value: string): string {
  return value;
}

export function validateMoneyInput(value: string, options: { required?: boolean } = {}): string | null {
  return value === '' && options.required === true ? null : null;
}
