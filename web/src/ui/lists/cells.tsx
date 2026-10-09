// SPEC-GAP: list cells (RED stub, plan 02-30).
import type { ReactNode } from 'react';
import type { IconName } from '@/ui/brand';

export function UserCell({ name, sub }: { name: string; sub: ReactNode }) {
  void name;
  void sub;
  return <span />;
}

export function CustomerCell({ team, customer }: { team?: string | null | undefined; customer: string }) {
  void team;
  void customer;
  return <div />;
}

export function RowActions({ children }: { children?: ReactNode }) {
  void children;
  return <span />;
}

export interface RowActionProps {
  icon: IconName;
  label: string;
  title?: string | undefined;
  danger?: boolean | undefined;
  onClick?: (() => void) | undefined;
}

export function RowAction(props: RowActionProps) {
  void props;
  return <button type="button" aria-label="stub" />;
}
