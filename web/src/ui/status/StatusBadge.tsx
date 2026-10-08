// RED stub (plan 02-19 Task 1): replaced in GREEN.
import type { OrderStatus } from '@/lib/csps';

export interface StatusBadgeProps {
  status?: OrderStatus;
  className?: string;
}

export function StatusBadge({ status = 'pending' }: StatusBadgeProps) {
  return <span>{status}</span>;
}
