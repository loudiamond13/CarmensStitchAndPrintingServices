// RED stub (plan 05-22): RadioGroup, written in the GREEN commit.
import type { ReactNode } from 'react';

export interface RadioOption<V extends string = string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
}

export interface RadioGroupProps<V extends string = string> {
  legend: ReactNode;
  name: string;
  value: V;
  onChange: (value: V) => void;
  options: readonly RadioOption<V>[];
}

export function RadioGroup<V extends string = string>(props: RadioGroupProps<V>) {
  void props;
  return null;
}
