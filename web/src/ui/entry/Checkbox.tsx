// SPEC-GAP: Checkbox (RED stub, plan 02-27 Task 2).
import type { ReactNode } from 'react';

export interface CheckboxProps {
  label: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  required?: boolean;
  id?: string;
  className?: string;
  hint?: ReactNode;
  error?: string;
}

export function Checkbox({ label }: CheckboxProps) {
  return <label>{label}</label>;
}
