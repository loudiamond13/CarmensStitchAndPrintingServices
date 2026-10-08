// RED placeholder (plan 13 Task 2): replaced by the implementation in the GREEN commit.
import type { ReactNode } from 'react';

export interface FilterBarProps {
  children: ReactNode;
  end?: ReactNode;
  label?: string;
}

export function FilterBar({ children }: FilterBarProps) {
  return <div>{children}</div>;
}

export interface ResultBarProps {
  count: number;
  thing: string;
  things: string;
  sortLabel?: string;
  children?: ReactNode;
}

export function ResultBar({ count, children }: ResultBarProps) {
  return (
    <div>
      {count}
      {children}
    </div>
  );
}

export interface FilterChipProps {
  label: string;
  value: string;
  onClear: () => void;
}

export function FilterChip({ label, value }: FilterChipProps) {
  return (
    <span>
      {label}
      {value}
    </span>
  );
}
