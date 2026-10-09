// SPEC-GAP: FilterBar, ResultBar and FilterChip (RED stub, plan 02-30).
import type { ReactNode } from 'react';

export interface FilterBarProps {
  children: ReactNode;
  end?: ReactNode;
  label?: string | undefined;
}

export function FilterBar(props: FilterBarProps) {
  void props;
  return <div />;
}

export interface ResultBarProps {
  count: number;
  thing: string;
  things: string;
  sortLabel?: string | undefined;
  children?: ReactNode;
}

export function ResultBar(props: ResultBarProps) {
  void props;
  return <div />;
}

export interface FilterChipProps {
  label: string;
  value: string;
  onClear: () => void;
}

export function FilterChip(props: FilterChipProps) {
  void props;
  return <span />;
}
