// RED stub (plan 02-23): the converted OrderTotals arrives in GREEN.
import type { Order, Totals } from '@/lib/csps';
import type { TotalsVariant } from './money.recipe';

export interface OrderTotalsProps {
  order?: Partial<Order> | undefined;
  totals?: Totals | undefined;
  variant?: TotalsVariant | undefined;
}

export function OrderTotals(_props: OrderTotalsProps) {
  return <div />;
}
