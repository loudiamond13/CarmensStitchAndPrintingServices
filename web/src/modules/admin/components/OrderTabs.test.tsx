import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  creditOrder,
  order0148,
  order0151,
  orderPayment,
  CASH,
  ORDER_STAFF,
  ORDER_STAFF_TWO,
} from '@/test/orderFixtures';

// The money tabs of the order page (ORD-07; plan 08-12): Payments, Discounts, Expenses and Refunds, each a heading and caption
// over a ResponsiveTable with a totals footer. Every figure is the server's; both people show on a money row (D-12).

/** The data rows of a table (no header, no footer). */
function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table)
    .getAllByRole('row')
    .slice(1, -1);
}

describe('the Payments tab (ORD-07, D-09, D-12)', () => {
  it('lists each payment with its date, method, reference, notes, both people and amount', () => {
    render(<OrderPaymentsTab order={order0148} />);

    const table = screen.getByRole('table', { name: 'Payments' });
    for (const name of [
      'Date',
      'Method',
      'Reference no.',
      'Notes',
      'Received by',
      'Recorded by',
      'Amount',
    ]) {
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const [first, second] = bodyRows(table);
    if (first === undefined || second === undefined) throw new Error('Expected two payment rows');
    expect(within(first).getByText('Sep 28, 2026')).toBeVisible();
    expect(within(first).getByText('GCash')).toBeVisible();
    expect(within(first).getByText('9012 345 678901')).toBeVisible();
    expect(within(first).getByText('50% downpayment')).toBeVisible();
    expect(within(first).getAllByText('Carmen Reyes')).toHaveLength(2);
    expect(within(first).getByText('₱10,000.00')).toBeVisible();
    expect(within(second).getByText('Oct 3, 2026')).toBeVisible();
    expect(within(second).getByText('Cash')).toBeVisible();
    expect(within(second).getByText('Not set')).toBeInTheDocument();
  });

  it('ends with Total paid from the server figure', () => {
    render(<OrderPaymentsTab order={order0148} />);

    const footer = within(screen.getByRole('table', { name: 'Payments' })).getByText('Total paid').closest('tr');
    if (footer === null) throw new Error('No footer row');
    expect(footer).toHaveTextContent('₱12,000.00');
  });

  it('keeps the order the server sent', () => {
    const later = orderPayment('2026-10-09', CASH, 100, { notes: 'later one' });
    const earlier = orderPayment('2026-10-01', CASH, 200, { notes: 'earlier one' });
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [later, earlier] })} />);

    const rows = bodyRows(screen.getByRole('table', { name: 'Payments' }));
    expect(rows[0]).toHaveTextContent('later one');
    expect(rows[1]).toHaveTextContent('earlier one');
  });

  it('names a deleted receiver and recorder with (former staff)', () => {
    const payment = orderPayment('2026-10-01', CASH, 500, {
      receivedBy: { ...ORDER_STAFF_TWO, formerStaff: true },
      recordedBy: { ...ORDER_STAFF, formerStaff: true },
    });
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [payment] })} />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Payments' }));
    if (row === undefined) throw new Error('Expected one payment row');
    expect(row).toHaveTextContent('Paolo Garcia (former staff)');
    expect(row).toHaveTextContent('Carmen Reyes (former staff)');
  });

  it('reads System for a payment with no recorder', () => {
    const payment = orderPayment('2026-10-01', CASH, 500, { recordedBy: null });
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [payment] })} />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Payments' }));
    if (row === undefined) throw new Error('Expected one payment row');
    expect(within(row).getByText('System')).toBeInTheDocument();
  });

  it.each([
    ['names the balance due', order0148, 'Downpayments and settlements. Balance due: ₱9,327.50'],
    ['names the customer credit', creditOrder, 'Downpayments and settlements. Customer credit: ₱1,000.00'],
    ['says nothing is owed', order0151, 'Downpayments and settlements. Nothing is owed on this order.'],
  ])('caption %s', (_name, order, caption) => {
    render(<OrderPaymentsTab order={order} />);

    expect(screen.getByText(/^Downpayments and settlements\./)).toHaveTextContent(caption);
  });

  it('shows an inline empty line and no table when there are no payments (UIC-4)', () => {
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [] })} />);

    expect(screen.getByText('No payments recorded yet.')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows no Add, Edit or Delete control when read only (D-24)', () => {
    render(<OrderPaymentsTab order={order0148} readOnly />);

    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderPaymentsTab order={order0148} />);

    await expectNoAxeViolations(container);
  });
});
