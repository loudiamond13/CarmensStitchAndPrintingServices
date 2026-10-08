// RED stub (plan 02-20 Task 2): renders nothing yet.
import type { ReactNode, SelectHTMLAttributes } from 'react';

export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
}

export function Select(_props: SelectProps) {
  return null;
}
