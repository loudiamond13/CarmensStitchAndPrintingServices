import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { OrdersTable } from '@/modules/admin/components/OrdersTable';
import { expectNoAxeViolations } from '@/test/axe';
import {
  cancelledOrderWithRefunds,
  completedOrder,
  creditOrder,
  listEntryOf,
  noDueDateOrder,
  ORDER_TODAY,
  order0148,
  order0151,
  order0153,
} from '@/test/orderFixtures';

// The table view of the Orders list (ORD-01, ORD-10, ORD-12, D-04, D-22, D-45, UIC-7, UIC-30; plan 08-11).

const ROWS = [
  order0148,
  order0151,
  order0153,
  creditOrder,
  cancelledOrderWithRefunds,
  completedOrder,
  noDueDateOrder,
].map(listEntryOf);

function renderTable(props: Partial<ComponentProps<typeof OrdersTable>> = {}) {
  const onOpen = vi.fn();
  const onEdit = vi.fn();
  const view = render(
    <MemoryRouter>
      <OrdersTable rows={ROWS} today={ORDER_TODAY} onOpen={onOpen} onEdit={onEdit} {...props} />
    </MemoryRouter>,
  );
  return { ...view, onOpen, onEdit };
}

/** The row of an order, found by its number. */
function rowOf(number: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(number) });
}

/** The cell of a row under a column, by the label every cell carries. */
function cellOf(number: string, column: string): HTMLElement {
  const cell = rowOf(number).querySelector<HTMLElement>(`[data-label="${column}"]`);
  if (cell === null) {
    throw new Error(`No ${column} cell in ${number}`);
  }
  return cell;
}

describe('the columns (UI-SPEC "Table view")', () => {
  it('names the table Orders and lists the nine columns in order, the last one a hidden Actions header', () => {
    renderTable();

    expect(screen.getByRole('table', { name: 'Orders' })).toBeVisible();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Order',
      'Customer',
      'Status',
      'Ordered',
      'Due',
      'Total',
      'Paid',
      'Balance',
      'Actions',
    ]);
    expect(screen.getByText('Actions').className).toContain('h-px');
  });

  it('shows the order number as a link to the order, beside a decorative placeholder thumbnail', () => {
    renderTable();

    const link = within(cellOf('ORD-2026-0148', 'Order')).getByRole('link', { name: 'ORD-2026-0148' });
    expect(link).toHaveAttribute('href', `/admin/orders/${order0148.id}`);
    expect(within(cellOf('ORD-2026-0148', 'Order')).queryByRole('img')).toBeNull();
  });

  it('opens the order through onOpen on a plain click and leaves a modified click to the link', async () => {
    const { onOpen } = renderTable();
    const link = screen.getByRole('link', { name: 'ORD-2026-0148' });

    await userEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ number: 'ORD-2026-0148' });

    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { shiftKey: true });
    fireEvent.click(link, { button: 1 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows the team bold over the customer, or the customer over Walk-in customer without a team', () => {
    renderTable();

    const withTeam = cellOf('ORD-2026-0148', 'Customer');
    expect(within(withTeam).getByText('Brgy. San Roque Ballers').tagName).toBe('STRONG');
    expect(within(withTeam).getByText('Juan Dela Cruz')).toBeVisible();
    const walkIn = cellOf('ORD-2026-0153', 'Customer');
    expect(within(walkIn).getByText('Angelica Santos').tagName).toBe('STRONG');
    expect(within(walkIn).getByText('Walk-in customer')).toBeVisible();
  });

  it('shows the status badge, the order date and the due date over its flag', () => {
    renderTable();

    expect(within(cellOf('ORD-2026-0148', 'Status')).getByText('In Production')).toBeVisible();
    expect(within(cellOf('ORD-2026-0148', 'Ordered')).getByText('Sep 28, 2026')).toBeVisible();
    const due = cellOf('ORD-2026-0148', 'Due');
    expect(within(due).getByText('Due Oct 14, 2026')).toBeVisible();
    expect(within(due).getByText('6 days left')).toBeVisible();
    expect(within(cellOf('ORD-2026-0153', 'Due')).getByText('Overdue by 3 days')).toBeVisible();
  });

  it('shows no due flag for a finished order, and an empty value for an order with no due date', () => {
    renderTable();

    expect(within(cellOf('ORD-2026-0142', 'Due')).getByText('Due Sep 30, 2026')).toBeVisible();
    expect(within(cellOf('ORD-2026-0142', 'Due')).queryByText(/Overdue|days left/)).toBeNull();
    expect(within(cellOf('ORD-2026-0101', 'Due')).getByText('Not set')).toBeInTheDocument();
  });

  it('shows Total, Paid and the balance as the server sent them (UIC-30)', () => {
    renderTable();

    expect(within(cellOf('ORD-2026-0148', 'Total')).getByText('₱21,327.50')).toBeVisible();
    expect(within(cellOf('ORD-2026-0148', 'Paid')).getByText('−₱12,000.00')).toBeVisible();
    expect(within(cellOf('ORD-2026-0148', 'Balance')).getByText('₱9,327.50')).toBeVisible();
  });
});

describe('the Balance cell (ORD-12, D-04, D-45)', () => {
  it('shows Fully Paid with a check for ORD-2026-0151, and no figure', () => {
    renderTable();

    const balance = cellOf('ORD-2026-0151', 'Balance');
    expect(within(balance).getByText('Fully Paid')).toBeVisible();
    expect(balance.querySelector('svg')).not.toBeNull();
    expect(within(balance).queryByText(/₱/)).toBeNull();
  });

  it('shows a customer credit as a Credit badge', () => {
    renderTable();

    expect(within(cellOf('ORD-2026-0160', 'Balance')).getByText('Credit ₱1,000.00')).toBeVisible();
    expect(within(cellOf('ORD-2026-0160', 'Balance')).queryByText('Fully Paid')).toBeNull();
  });

  it('shows Not collected under a muted figure for a Cancelled order with money unpaid', () => {
    renderTable();

    const balance = cellOf('ORD-2026-0139', 'Balance');
    expect(within(balance).getByText('Not collected')).toBeVisible();
    expect(within(balance).getByText('₱5,500.00')).toHaveClass('text-ink-muted');
  });

  it('shows the due figure with no Not collected for an order still open', () => {
    renderTable();

    expect(within(cellOf('ORD-2026-0153', 'Balance')).getByText('₱6,360.00')).toBeVisible();
    expect(within(cellOf('ORD-2026-0153', 'Balance')).queryByText('Not collected')).toBeNull();
  });
});

describe('an unpaid order (UIC-7)', () => {
  it('shows the empty value, not a zero, in the Paid cell', () => {
    renderTable();

    const paid = cellOf('ORD-2026-0101', 'Paid');
    expect(within(paid).getByText('Not set')).toBeInTheDocument();
    expect(paid).not.toHaveTextContent('₱0.00');
  });
});

describe('the row actions (D-22, D-46, D-57)', () => {
  it('names View and Edit by their order and gives each a matching title', () => {
    renderTable();

    const row = rowOf('ORD-2026-0148');
    const view = within(row).getByRole('button', { name: 'View order ORD-2026-0148' });
    const edit = within(row).getByRole('button', { name: 'Edit details of order ORD-2026-0148' });
    expect(view).toHaveAttribute('title', 'View order ORD-2026-0148');
    expect(edit).toHaveAttribute('title', 'Edit details of order ORD-2026-0148');
  });

  it('calls onOpen for View and onEdit for Edit with the row', async () => {
    const { onOpen, onEdit } = renderTable();
    const row = rowOf('ORD-2026-0151');

    await userEvent.click(within(row).getByRole('button', { name: 'View order ORD-2026-0151' }));
    await userEvent.click(within(row).getByRole('button', { name: 'Edit details of order ORD-2026-0151' }));

    expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ number: 'ORD-2026-0151' });
    expect(onEdit.mock.calls[0]?.[0]).toMatchObject({ number: 'ORD-2026-0151' });
  });

  it.each(['ORD-2026-0142', 'ORD-2026-0139'])('has no Edit on the Completed or Cancelled order %s', (number) => {
    renderTable();

    const row = rowOf(number);
    expect(within(row).getByRole('button', { name: `View order ${number}` })).toBeVisible();
    expect(within(row).queryByRole('button', { name: /^Edit details/ })).toBeNull();
  });

  it('has no Delete anywhere', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});

describe('what the table never shows (D-04, D-06, UIC-30)', () => {
  it('has no Discount, Order Expenses or Estimated Profit', () => {
    const { container } = renderTable();

    expect(container).not.toHaveTextContent(/Discount|Order Expenses|Estimated Profit|Profit/);
  });
});

describe('the table states', () => {
  it('shows a skeleton table of 4 rows and no rows while the first load runs', () => {
    renderTable({ rows: undefined, pending: true });

    expect(screen.getByText('Loading orders…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ORD-/ })).toBeNull();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('shows No active orders with New Order when the default view has no rows', () => {
    renderTable({
      rows: [],
      emptyIcon: 'clipboard-list',
      emptyTitle: 'No active orders',
      emptyMessage: 'Nothing here.',
    });

    expect(screen.getByRole('heading', { name: 'No active orders' })).toBeVisible();
  });

  it('shows No matches with Clear Filters for a search with no rows', async () => {
    const onClearFilters = vi.fn();
    renderTable({ rows: [], filtered: true, search: 'zzz', filterSummary: 'status Delivered', onClearFilters });

    expect(screen.getByRole('heading', { name: 'No matches' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows the load error with Try Again', async () => {
    const onRetry = vi.fn();
    renderTable({ rows: undefined, failed: true, onRetry });

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('accessibility', () => {
  it('has no axe violations with every balance state on screen', async () => {
    const { container } = renderTable();

    await expectNoAxeViolations(container);
  });
});
