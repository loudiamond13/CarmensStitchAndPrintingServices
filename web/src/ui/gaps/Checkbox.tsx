// RED placeholder (plan 02-12 Task 2): the real Checkbox replaces this in the GREEN commit.
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'children' | 'required' | 'id' | 'className'
> {
  label: ReactNode;
  onChange?: (checked: boolean) => void;
  required?: boolean;
  id?: string;
  className?: string;
  hint?: ReactNode;
  error?: string;
}

export function Checkbox({ name }: CheckboxProps) {
  return (
    <label className="s-check">
      <input type="checkbox" name={name} />
      Checkbox
    </label>
  );
}
