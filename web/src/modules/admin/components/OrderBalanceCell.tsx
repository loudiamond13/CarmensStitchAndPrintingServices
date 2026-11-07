// RED stub (plan 10-09): the balance cell moves here from OrdersTable in the GREEN commit.
import type { OrderListEntry } from '@/modules/admin/services/ordersService';

export function orderBalanceKind(entry: OrderListEntry): 'credit' | 'paid' | 'notCollected' | 'due' {
  return entry.status === 'never' ? 'due' : 'due';
}

export function OrderBalanceCell({ entry }: { entry: OrderListEntry }) {
  return <span data-number={entry.number} />;
}
