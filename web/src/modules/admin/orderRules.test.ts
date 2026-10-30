import { describe, expect, it } from 'vitest';
import {
  canAddPayment,
  canAddRefund,
  canChangeRefund,
  canComplete,
  canDeleteItem,
  canEditOrder,
  isLocked,
  refundCap,
  showRefundsTab,
} from '@/modules/admin/orderRules';
import {
  BASKETBALL_JERSEY,
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  creditOrder,
  order0148,
  order0151,
  orderItem,
  orderRefund,
  type OrderDetailFixture,
} from '@/test/orderFixtures';

// What an order allows, from the server's figures and status only (D-13, D-15, D-39, D-48, 07 D-04, 07 D-35). Money is judged
// by the centavo, so a stray half-centavo never changes an answer.

/** An order with only its money block changed. */
function withTotals(
  base: OrderDetailFixture,
  totals: Partial<OrderDetailFixture['totals']>,
  overrides: Partial<OrderDetailFixture> = {},
): OrderDetailFixture {
  return buildOrderDetail({ ...base, ...overrides, totals: { ...base.totals, ...totals } });
}

describe('isLocked and canEditOrder (D-15, D-39)', () => {
  it.each(['completed', 'cancelled'])('locks a %s order', (status) => {
    const order = buildOrderDetail({ status });
    expect(isLocked(order)).toBe(true);
    expect(canEditOrder(order)).toBe(false);
  });

  it.each(['pending', 'mockup', 'production', 'ready', 'delivered'])('leaves a %s order open', (status) => {
    const order = buildOrderDetail({ status });
    expect(isLocked(order)).toBe(false);
    expect(canEditOrder(order)).toBe(true);
  });
});

describe('showRefundsTab (D-13)', () => {
  it('shows the tab on a cancelled order', () => {
    expect(showRefundsTab(withTotals(order0148, {}, { status: 'cancelled', refunds: [] }))).toBe(true);
  });

  it('shows the tab when the customer is owed credit', () => {
    expect(showRefundsTab(creditOrder)).toBe(true);
  });

  it('shows the tab when the order already has refunds', () => {
    const refunded = buildOrderDetail({ refunds: [orderRefund('2026-10-05', 100, 'Short delivery')] });
    expect(showRefundsTab(refunded)).toBe(true);
  });

  it('hides the tab on an ordinary open order', () => {
    expect(showRefundsTab(order0148)).toBe(false);
  });

  it('hides the tab for a credit under half a centavo', () => {
    expect(showRefundsTab(withTotals(order0148, { customerCredit: 0.004 }))).toBe(false);
  });
});

describe('refundCap (07 D-09, D-35)', () => {
  it('is the customer credit on an order that is not cancelled', () => {
    expect(refundCap(creditOrder)).toBe('1000.00');
  });

  it('is what was paid minus what was handed back on a cancelled order', () => {
    expect(refundCap(cancelledOrderWithRefunds)).toBe('2000.00');
  });

  it('adds the refund being edited back, because its amount is already out of the figures', () => {
    expect(refundCap(cancelledOrderWithRefunds, 1000)).toBe('3000.00');
    const lowered = withTotals(creditOrder, { customerCredit: 400 });
    expect(refundCap(lowered, '600.00')).toBe('1000.00');
  });

  it('is 0.00 when nothing can be handed back, never negative', () => {
    expect(refundCap(order0148)).toBe('0.00');
    expect(refundCap(withTotals(cancelledOrderWithRefunds, { paid: 500, refunded: 900 }))).toBe('0.00');
  });

  it('keeps whole centavos exactly', () => {
    expect(refundCap(withTotals(creditOrder, { customerCredit: 1234.56 }))).toBe('1234.56');
    expect(refundCap(withTotals(creditOrder, { customerCredit: 0.1 }), 0.2)).toBe('0.30');
  });
});

describe('canAddPayment (D-48)', () => {
  it('is true on an open order with a balance', () => {
    expect(canAddPayment(order0148)).toBe(true);
  });

  it('is false when nothing is owed', () => {
    expect(canAddPayment(order0151)).toBe(false);
  });

  it('is false when the customer is owed credit', () => {
    expect(canAddPayment(creditOrder)).toBe(false);
  });

  it('is false on a locked order even with a balance', () => {
    expect(canAddPayment(withTotals(order0148, { balance: 500 }, { status: 'cancelled' }))).toBe(false);
  });
});

describe('canComplete (07 D-04)', () => {
  it('is true when the balance is exactly 0.00 and no credit is owed', () => {
    expect(canComplete(order0151)).toBe(true);
  });

  it('is false while money is owed', () => {
    expect(canComplete(order0148)).toBe(false);
  });

  it('is false for a credit order, even when fullyPaid is true', () => {
    const overpaid = withTotals(creditOrder, { fullyPaid: true });
    expect(overpaid.totals.fullyPaid).toBe(true);
    expect(canComplete(overpaid)).toBe(false);
  });

  it('judges the balance by the centavo', () => {
    expect(canComplete(withTotals(order0151, { balance: 0.004 }))).toBe(true);
    expect(canComplete(withTotals(order0151, { balance: 0.01 }))).toBe(false);
  });

  it('is true for the finished fixture as well, because only the figures decide', () => {
    expect(canComplete(completedOrder)).toBe(true);
  });
});

describe('canDeleteItem (D-48)', () => {
  it('is true while more than one item is left', () => {
    expect(canDeleteItem(order0148)).toBe(true);
  });

  it('is false for the last item', () => {
    const single = buildOrderDetail({ items: [orderItem(BASKETBALL_JERSEY, 'Only line', 1, 100)] });
    expect(canDeleteItem(single)).toBe(false);
  });
});

describe('canAddRefund (ORD-18, D-13, D-19, UIC-48)', () => {
  it('is true for a credit order that is not completed', () => {
    expect(canAddRefund(creditOrder)).toBe(true);
  });

  it('is true for a Cancelled order with money paid and not yet handed back', () => {
    expect(canAddRefund(cancelledOrderWithRefunds)).toBe(true);
  });

  it('is false when the cap is 0.00: a Cancelled order that has refunded everything, and an open order with no credit', () => {
    expect(canAddRefund(withTotals(cancelledOrderWithRefunds, { refunded: 3000 }))).toBe(false);
    expect(canAddRefund(order0148)).toBe(false);
  });

  it('is false on a Completed order, even with a credit', () => {
    expect(canAddRefund(buildOrderDetail({ ...creditOrder, status: 'completed' }))).toBe(false);
  });
});

describe('canChangeRefund (ORD-18, D-13, 07 D-35)', () => {
  it('is true on a Cancelled order and an open order, false on a Completed one', () => {
    expect(canChangeRefund(cancelledOrderWithRefunds)).toBe(true);
    expect(canChangeRefund(creditOrder)).toBe(true);
    expect(canChangeRefund(completedOrder)).toBe(false);
  });
});
