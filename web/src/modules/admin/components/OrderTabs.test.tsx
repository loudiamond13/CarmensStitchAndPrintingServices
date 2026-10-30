import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { OrderCustomerCard } from '@/modules/admin/components/OrderCustomerCard';
import { OrderDiscountsTab } from '@/modules/admin/components/OrderDiscountsTab';
import { OrderExpensesTab } from '@/modules/admin/components/OrderExpensesTab';
import { OrderItemsTab } from '@/modules/admin/components/OrderItemsTab';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { OrderRefundsTab } from '@/modules/admin/components/OrderRefundsTab';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  FABRIC,
  creditOrder,
  order0148,
  order0151,
  orderDiscount,
  orderExpense,
  orderPayment,
  orderRefund,
  CASH,
  ORDER_STAFF,
  ORDER_STAFF_TWO,
} from '@/test/orderFixtures';

// The money tabs of the order page (ORD-07; plan 08-12): Payments, Discounts, Expenses and Refunds, each a heading and caption
// over a ResponsiveTable with a totals footer. Every figure is the server's; both people show on a money row (D-12).

/** The data rows of a table (no header, no footer). */
function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1, -1);
}

describe('the Payments tab (ORD-07, D-09, D-12)', () => {
  it('lists each payment with its date, method, reference, notes, both people and amount', () => {
    render(<OrderPaymentsTab order={order0148} readOnly />);

    const table = screen.getByRole('table', { name: 'Payments' });
    for (const name of ['Date', 'Method', 'Reference no.', 'Notes', 'Received by', 'Recorded by', 'Amount']) {
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
    render(<OrderPaymentsTab order={order0148} readOnly />);

    const footer = within(screen.getByRole('table', { name: 'Payments' }))
      .getByText('Total paid')
      .closest('tr');
    if (footer === null) throw new Error('No footer row');
    expect(footer).toHaveTextContent('₱12,000.00');
  });

  it('keeps the order the server sent', () => {
    const later = orderPayment('2026-10-09', CASH, 100, { notes: 'later one' });
    const earlier = orderPayment('2026-10-01', CASH, 200, { notes: 'earlier one' });
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [later, earlier] })} readOnly />);

    const rows = bodyRows(screen.getByRole('table', { name: 'Payments' }));
    expect(rows[0]).toHaveTextContent('later one');
    expect(rows[1]).toHaveTextContent('earlier one');
  });

  it('names a deleted receiver and recorder with (former staff)', () => {
    const payment = orderPayment('2026-10-01', CASH, 500, {
      receivedBy: { ...ORDER_STAFF_TWO, formerStaff: true },
      recordedBy: { ...ORDER_STAFF, formerStaff: true },
    });
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [payment] })} readOnly />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Payments' }));
    if (row === undefined) throw new Error('Expected one payment row');
    expect(row).toHaveTextContent('Paolo Garcia (former staff)');
    expect(row).toHaveTextContent('Carmen Reyes (former staff)');
  });

  it('reads System for a payment with no recorder', () => {
    const payment = orderPayment('2026-10-01', CASH, 500, { recordedBy: null });
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [payment] })} readOnly />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Payments' }));
    if (row === undefined) throw new Error('Expected one payment row');
    expect(within(row).getByText('System')).toBeInTheDocument();
  });

  it.each([
    ['names the balance due', order0148, 'Downpayments and settlements. Balance due: ₱9,327.50'],
    ['names the customer credit', creditOrder, 'Downpayments and settlements. Customer credit: ₱1,000.00'],
    ['says nothing is owed', order0151, 'Downpayments and settlements. Nothing is owed on this order.'],
  ])('caption %s', (_name, order, caption) => {
    render(<OrderPaymentsTab order={order} readOnly />);

    expect(screen.getByText(/^Downpayments and settlements\./)).toHaveTextContent(caption);
  });

  it('shows an inline empty line and no table when there are no payments (UIC-4)', () => {
    render(<OrderPaymentsTab order={buildOrderDetail({ payments: [] })} readOnly />);

    expect(screen.getByText('No payments recorded yet.')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows no Add, Edit or Delete control when read only (D-24)', () => {
    render(<OrderPaymentsTab order={order0148} readOnly />);

    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderPaymentsTab order={order0148} readOnly />);

    await expectNoAxeViolations(container);
  });
});

describe('the Discounts tab (ORD-07)', () => {
  it('lists a percentage discount with its reason, type, value and negative amount', () => {
    render(<OrderDiscountsTab order={order0148} readOnly />);

    const table = screen.getByRole('table', { name: 'Discounts' });
    for (const name of ['Reason', 'Type', 'Value', 'Amount']) {
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const [row] = bodyRows(table);
    if (row === undefined) throw new Error('Expected one discount row');
    expect(within(row).getByText('Barangay league discount')).toBeVisible();
    expect(within(row).getByText('Percentage')).toBeVisible();
    expect(within(row).getByText('5%')).toBeVisible();
    expect(within(row).getByText('−₱1,122.50')).toBeVisible();
  });

  it('lists a fixed discount with its peso value', () => {
    render(<OrderDiscountsTab order={order0151} readOnly />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Discounts' }));
    if (row === undefined) throw new Error('Expected one discount row');
    expect(within(row).getByText('Fixed amount')).toBeVisible();
    expect(within(row).getByText('₱500.00')).toBeVisible();
    expect(within(row).getByText('−₱500.00')).toBeVisible();
  });

  it('gives each discount its own row', () => {
    const order = buildOrderDetail({
      discounts: [orderDiscount('fixed', 100, 'First'), orderDiscount('fixed', 50, 'Second')],
    });
    render(<OrderDiscountsTab order={order} readOnly />);

    expect(bodyRows(screen.getByRole('table', { name: 'Discounts' }))).toHaveLength(2);
  });

  it('ends with Total discount from the server figure, and names the caption', () => {
    render(<OrderDiscountsTab order={order0148} readOnly />);

    const footer = within(screen.getByRole('table', { name: 'Discounts' }))
      .getByText('Total discount')
      .closest('tr');
    if (footer === null) throw new Error('No footer row');
    expect(footer).toHaveTextContent('−₱1,122.50');
    expect(screen.getByText('Percentages apply to the items total.')).toBeVisible();
  });

  it('shows an inline empty line when there are no discounts (UIC-4)', () => {
    render(<OrderDiscountsTab order={buildOrderDetail({ discounts: [] })} readOnly />);

    expect(screen.getByText('No discounts yet.')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows no Add, Edit or Delete control when read only (D-24)', () => {
    render(<OrderDiscountsTab order={order0148} readOnly />);

    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderDiscountsTab order={order0148} readOnly />);

    await expectNoAxeViolations(container);
  });
});

describe('the Expenses tab (ORD-07, D-12)', () => {
  it('lists each expense with its date, category, description, both people and amount', () => {
    render(<OrderExpensesTab order={order0148} readOnly />);

    const table = screen.getByRole('table', { name: 'Expenses' });
    for (const name of ['Date', 'Category', 'Description', 'Paid by', 'Recorded by', 'Amount']) {
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const [first] = bodyRows(table);
    if (first === undefined) throw new Error('Expected expense rows');
    expect(within(first).getByText('Oct 1, 2026')).toBeVisible();
    expect(within(first).getByText('Fabric')).toBeVisible();
    expect(within(first).getByText('Dri-fit mesh, 45 yds')).toBeVisible();
    expect(within(first).getAllByText('Carmen Reyes')).toHaveLength(2);
    expect(within(first).getByText('₱3,825.00')).toBeVisible();
  });

  it('shows the empty value for an expense with no description', () => {
    render(<OrderExpensesTab order={order0151} readOnly />);

    const [first] = bodyRows(screen.getByRole('table', { name: 'Expenses' }));
    if (first === undefined) throw new Error('Expected expense rows');
    expect(within(first).getByText('Not set')).toBeInTheDocument();
  });

  it('ends with Order expenses from the server figure, and says the costs are internal', () => {
    render(<OrderExpensesTab order={order0148} readOnly />);

    const footer = within(screen.getByRole('table', { name: 'Expenses' }))
      .getByText('Order expenses')
      .closest('tr');
    if (footer === null) throw new Error('No footer row');
    expect(footer).toHaveTextContent('₱6,065.00');
    expect(screen.getByText('Internal costs for this order. Not shown to the customer.')).toBeVisible();
  });

  it('names a person whose account was deleted with (former staff)', () => {
    const expense = orderExpense('2026-10-01', FABRIC, 100, 'Thread', {
      paidBy: { ...ORDER_STAFF_TWO, formerStaff: true },
    });
    render(<OrderExpensesTab order={buildOrderDetail({ expenses: [expense] })} readOnly />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Expenses' }));
    if (row === undefined) throw new Error('Expected one expense row');
    expect(row).toHaveTextContent('Paolo Garcia (former staff)');
  });

  it('shows an inline empty line when there are no expenses (UIC-4)', () => {
    render(<OrderExpensesTab order={buildOrderDetail({ expenses: [] })} readOnly />);

    expect(screen.getByText('No expenses recorded yet.')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows no Add, Edit or Delete control when read only (D-24)', () => {
    render(<OrderExpensesTab order={order0148} readOnly />);

    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderExpensesTab order={order0148} readOnly />);

    await expectNoAxeViolations(container);
  });
});

describe('the Refunds tab (ORD-07, D-10, D-12)', () => {
  it('lists each refund with its date, reason, both people and amount', () => {
    render(<OrderRefundsTab order={cancelledOrderWithRefunds} />);

    const table = screen.getByRole('table', { name: 'Refunds' });
    for (const name of ['Date', 'Reason', 'Refunded by', 'Recorded by', 'Amount']) {
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const [row] = bodyRows(table);
    if (row === undefined) throw new Error('Expected one refund row');
    expect(within(row).getByText('Sep 20, 2026')).toBeVisible();
    expect(within(row).getByText('Order cancelled by the customer')).toBeVisible();
    expect(within(row).getAllByText('Carmen Reyes')).toHaveLength(2);
    expect(within(row).getByText('₱1,000.00')).toBeVisible();
  });

  it('ends with Total refunded from the server figure, and names the caption', () => {
    render(<OrderRefundsTab order={cancelledOrderWithRefunds} readOnly />);

    const footer = within(screen.getByRole('table', { name: 'Refunds' }))
      .getByText('Total refunded')
      .closest('tr');
    if (footer === null) throw new Error('No footer row');
    expect(footer).toHaveTextContent('₱1,000.00');
    expect(screen.getByText('Money handed back to the customer.')).toBeVisible();
  });

  it('names a refunder whose account was deleted with (former staff)', () => {
    const refund = orderRefund('2026-10-05', 300, 'Wrong size', {
      refundedBy: { ...ORDER_STAFF_TWO, formerStaff: true },
    });
    render(<OrderRefundsTab order={buildOrderDetail({ refunds: [refund] })} />);

    const [row] = bodyRows(screen.getByRole('table', { name: 'Refunds' }));
    if (row === undefined) throw new Error('Expected one refund row');
    expect(row).toHaveTextContent('Paolo Garcia (former staff)');
  });

  it('shows an inline empty line when there are no refunds (UIC-4)', () => {
    render(<OrderRefundsTab order={creditOrder} />);

    expect(screen.getByText('No refunds recorded yet.')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows no Add, Edit or Delete control when read only (D-24)', () => {
    render(<OrderRefundsTab order={cancelledOrderWithRefunds} readOnly />);

    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderRefundsTab order={cancelledOrderWithRefunds} />);

    await expectNoAxeViolations(container);
  });
});

describe('the customer card read only (D-24)', () => {
  it('shows the Edit Details link on an active order and hides it when read only', () => {
    const { unmount } = render(
      <MemoryRouter>
        <OrderCustomerCard order={order0148} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Edit Details' })).toBeVisible();
    unmount();

    render(
      <MemoryRouter>
        <OrderCustomerCard order={order0148} readOnly />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Juan Dela Cruz')).toBeVisible();
  });
});

describe('the Items tab read only (D-24)', () => {
  it('shows no Add, Edit or Delete control when read only', () => {
    render(<OrderItemsTab order={order0148} readOnly />);

    expect(screen.getByRole('table', { name: 'Order items' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });
});
