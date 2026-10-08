// RED stub (plan 02-20 Task 1): renders nothing yet.
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

interface FieldBase {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export type FieldProps =
  | (FieldBase & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>)
  | (FieldBase & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'>);

export function Field(_props: FieldProps) {
  return null;
}
