// What an order allows, decided from the server's status and money figures only (D-13, D-15, D-39, D-48, 07 D-04, 07 D-35).
// Nothing here works out an order total. Money is judged by the centavo (isPositiveMoney, isNegativeMoney), so a half-centavo
// never changes an answer. Every screen asks these functions, so the rules live in one tested place.
import { isNegativeMoney, isPositiveMoney } from '@/utils/csps';
import { centavosToMoneyText } from '@/utils/format';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

/** The parts of an order the rules read. */
type RuledOrder = Pick<OrderDetailResponse, 'status' | 'totals' | 'items' | 'refunds'>;

/** Completed and Cancelled orders are locked until they are reopened (D-15). */
export function isLocked(order: Pick<RuledOrder, 'status'>): boolean {
  return order.status === 'completed' || order.status === 'cancelled';
}

/** Edit Details, the customer card link, the header Delete and every Add, Edit and Delete follow this (D-15, D-39). */
export function canEditOrder(order: Pick<RuledOrder, 'status'>): boolean {
  return !isLocked(order);
}

/** The Refunds tab shows on a Cancelled order, when credit is owed, or when refunds already exist (D-13). */
export function showRefundsTab(order: Pick<RuledOrder, 'status' | 'totals' | 'refunds'>): boolean {
  return order.status === 'cancelled' || isPositiveMoney(order.totals.customerCredit) || order.refunds.length > 0;
}

/** Whole centavos of a server figure. The server sends two decimals, so the rounding only removes float noise. */
function centavosOf(value: number | string | null | undefined): number {
  return value === null || value === undefined ? 0 : Math.round(Number(value) * 100);
}

/**
 * The most a refund may be: the customer credit on an open order, or what was paid minus what was handed back on a Cancelled
 * one (07 D-09, D-35). When a saved refund is edited, its own amount (`savedAmount`) is already out of those figures, so it is
 * added back. A preview from server figures for the window's helper line and its check, as money text; the server decides.
 */
export function refundCap(order: Pick<RuledOrder, 'status' | 'totals'>, savedAmount?: number | string | null): string {
  const { totals } = order;
  const base =
    order.status === 'cancelled'
      ? centavosOf(totals.paid) - centavosOf(totals.refunded)
      : centavosOf(totals.customerCredit);
  return centavosToMoneyText(Math.max(0, base + centavosOf(savedAmount)));
}

/**
 * A refund can be added while the cap is above 0.00 and the order is not Completed: on a Cancelled order that is what was paid
 * and not yet handed back, on any other the customer credit (D-13, D-19, 07 D-35). A Completed order is locked.
 */
export function canAddRefund(order: Pick<RuledOrder, 'status' | 'totals'>): boolean {
  return order.status !== 'completed' && isPositiveMoney(refundCap(order));
}

/** A refund can be edited or deleted on a Cancelled or open order; a Completed order is locked (07 D-35). */
export function canChangeRefund(order: Pick<RuledOrder, 'status'>): boolean {
  return order.status !== 'completed';
}

/** A payment can be added to an open order while money is owed (D-48). */
export function canAddPayment(order: Pick<RuledOrder, 'status' | 'totals'>): boolean {
  return !isLocked(order) && isPositiveMoney(order.totals.balance);
}

/**
 * Mark Completed needs a balance of exactly 0.00 and no customer credit (07 D-04). `fullyPaid` alone is not enough: an
 * overpaid order is fully paid and still owes the customer money.
 */
export function canComplete(order: Pick<RuledOrder, 'totals'>): boolean {
  const { balance, customerCredit } = order.totals;
  return !isPositiveMoney(balance) && !isNegativeMoney(balance) && !isPositiveMoney(customerCredit);
}

/** An order keeps at least one item, so the last one cannot be deleted (D-48). */
export function canDeleteItem(order: Pick<RuledOrder, 'items'>): boolean {
  return order.items.length > 1;
}
