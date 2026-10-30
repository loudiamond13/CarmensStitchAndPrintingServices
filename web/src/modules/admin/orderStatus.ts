// What the order page says about a status key: its label, the statuses an order can be moved to, and what the toasts name.
import { isOrderStatus } from '@/components/status';
import { ACTIVE_STATUSES, ORDER_STATUSES, type OrderStatus } from '@/utils/csps';

/** The label of a status key; a key the types do not know shows as sent. */
export function orderStatusLabel(key: string): string {
  return isOrderStatus(key) ? ORDER_STATUSES[key] : key;
}

/** The active statuses an order is not in, in order (Pending to Delivered): the targets of "Move to {Status}" (D-14). */
export function otherActiveStatuses(current: string): readonly OrderStatus[] {
  return ACTIVE_STATUSES.filter((status) => status !== current);
}

/** The element ids the order page uses to put focus on the Change Status and Reopen Order buttons after a change. */
export const CHANGE_STATUS_ID = 'order-change-status';
export const REOPEN_ORDER_ID = 'order-reopen';
