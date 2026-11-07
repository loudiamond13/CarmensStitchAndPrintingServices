// The Balance cell shared by the Orders list and Recent orders on the dashboard (ORD-12, 08 D-02, D-04, D-45). Every figure is
// the server's, as sent (D-09): no sum here. It was OrdersTable's own until the dashboard needed the same states.
import { Icon } from '@/components/brand';
import { Badge } from '@/components/status';
import {
  ordersBalanceFigureClasses,
  ordersBalanceStackClasses,
  ordersFullyPaidClasses,
  ordersNotCollectedClasses,
} from '@/modules/admin/components/orders.recipe';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';

const COPY = ORDERS_COPY.list.table;

/** The balance block's state, first match wins (D-02, ORD-12, D-45): the same rule as the card's OrderTotals. */
export function orderBalanceKind(entry: OrderListEntry): 'credit' | 'paid' | 'notCollected' | 'due' {
  if (isPositiveMoney(entry.customerCredit)) return 'credit';
  if (entry.fullyPaid) return 'paid';
  if (entry.status === 'cancelled' && isPositiveMoney(entry.balance)) return 'notCollected';
  return 'due';
}

export function OrderBalanceCell({ entry }: { entry: OrderListEntry }) {
  switch (orderBalanceKind(entry)) {
    case 'credit':
      return <Badge tone="info">{COPY.credit(formatPeso(entry.customerCredit))}</Badge>;
    case 'paid':
      return (
        <span className={ordersFullyPaidClasses}>
          <Icon name="circle-check" size={18} />
          {COPY.fullyPaid}
        </span>
      );
    case 'notCollected':
      return (
        <span className={ordersBalanceStackClasses}>
          <span className={ordersBalanceFigureClasses.muted}>{formatPeso(entry.balance)}</span>
          <span className={ordersNotCollectedClasses}>{COPY.notCollected}</span>
        </span>
      );
    case 'due':
      return <span className={ordersBalanceFigureClasses.due}>{formatPeso(entry.balance)}</span>;
  }
}
