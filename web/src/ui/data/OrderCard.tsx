// OrderCard (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4). RED stub: inert until the GREEN step.
import type { Order, Totals } from '@/lib/csps';

export interface OrderCardProps {
  order: Order;
  totals?: Totals | undefined;
  onView?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

export function OrderCard(_props: OrderCardProps) {
  return <article />;
}
