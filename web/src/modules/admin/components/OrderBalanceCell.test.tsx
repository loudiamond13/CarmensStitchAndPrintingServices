import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderBalanceCell, orderBalanceKind } from '@/modules/admin/components/OrderBalanceCell';
import { expectNoAxeViolations } from '@/test/axe';
import { buildOrderListEntry } from '@/test/orderFixtures';

// The Balance cell shared by the Orders list and Recent orders (ORD-12, 08 D-02, D-04, D-45): the first matching state wins.

describe('orderBalanceKind', () => {
  it('is credit when the shop owes the customer, even if the order is also fully paid or cancelled', () => {
    expect(orderBalanceKind(buildOrderListEntry({ customerCredit: 1000, fullyPaid: true }))).toBe('credit');
    expect(orderBalanceKind(buildOrderListEntry({ customerCredit: '1000.00', status: 'cancelled', balance: 50 }))).toBe(
      'credit',
    );
  });

  it('is paid for a fully paid order with no credit', () => {
    expect(orderBalanceKind(buildOrderListEntry({ customerCredit: 0, fullyPaid: true, balance: 0 }))).toBe('paid');
  });

  it('is notCollected for a Cancelled order with money still unpaid', () => {
    expect(
      orderBalanceKind(
        buildOrderListEntry({ customerCredit: 0, fullyPaid: false, status: 'cancelled', balance: 5500 }),
      ),
    ).toBe('notCollected');
  });

  it('is due otherwise, including a Cancelled order with nothing unpaid', () => {
    expect(orderBalanceKind(buildOrderListEntry({ customerCredit: 0, fullyPaid: false, balance: 9327.5 }))).toBe('due');
    expect(
      orderBalanceKind(buildOrderListEntry({ customerCredit: 0, fullyPaid: false, status: 'cancelled', balance: 0 })),
    ).toBe('due');
  });
});

describe('OrderBalanceCell', () => {
  it('writes the due figure in pesos', async () => {
    const { container } = render(
      <OrderBalanceCell entry={buildOrderListEntry({ customerCredit: 0, fullyPaid: false, balance: 9327.5 })} />,
    );

    expect(screen.getByText('₱9,327.50')).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('writes Fully Paid with its check', () => {
    const { container } = render(
      <OrderBalanceCell entry={buildOrderListEntry({ customerCredit: 0, fullyPaid: true, balance: 0 })} />,
    );

    expect(screen.getByText('Fully Paid')).toBeVisible();
    expect(container.querySelector('svg.lucide-circle-check')).not.toBeNull();
  });

  it('writes the customer credit as a badge', () => {
    render(<OrderBalanceCell entry={buildOrderListEntry({ customerCredit: 1000, balance: 0 })} />);

    expect(screen.getByText('Credit ₱1,000.00')).toBeVisible();
  });

  it('writes the unpaid figure muted over Not collected for a Cancelled order', () => {
    render(
      <OrderBalanceCell
        entry={buildOrderListEntry({ customerCredit: 0, fullyPaid: false, status: 'cancelled', balance: 5500 })}
      />,
    );

    expect(screen.getByText('₱5,500.00').className).toContain('text-ink-muted');
    expect(screen.getByText('Not collected')).toBeVisible();
  });
});
