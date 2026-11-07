import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RecentOrdersCard } from '@/modules/admin/components/RecentOrdersCard';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { expectNoAxeViolations } from '@/test/axe';
import {
  dashboardNewShopSummary,
  dashboardNovemberSummary,
  dashboardRecentOrders,
  RECENT_ORDERS_TODAY,
  type DashboardSummaryFixture,
} from '@/test/dashboardFixtures';
import { buildOrderListEntry, listEntryOf, order0151, orderId } from '@/test/orderFixtures';

// Recent orders (DASH-05, DASH-06, D-38, 08 D-36 to D-38; plan 10-09): the six newest orders, each opened from its number or
// its eye link, with the due flag and the balance state of the Orders list. Every figure is the server's.

function queryOf(overrides: Partial<DashboardCardQuery> = {}): DashboardCardQuery {
  return { data: undefined, isPending: false, isError: false, error: null, refetch: vi.fn(), ...overrides };
}

function summaryOf(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return dashboardNovemberSummary({
    today: RECENT_ORDERS_TODAY,
    recentOrders: dashboardRecentOrders(),
    ...overrides,
  });
}

function loaded(data: DashboardSummaryFixture = summaryOf()): DashboardCardQuery {
  return queryOf({ data });
}

function renderCard(query: DashboardCardQuery) {
  return render(
    <MemoryRouter>
      <RecentOrdersCard query={query} />
    </MemoryRouter>,
  );
}

/** The row of an order, found by its number. */
function rowOf(number: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(number) });
}

/** A cell of a row, found by the label every cell carries. */
function cellOf(number: string, label: string): HTMLElement {
  const cell = rowOf(number).querySelector<HTMLElement>(`[data-label="${label}"]`);
  if (cell === null) {
    throw new Error(`No ${label} cell in ${number}`);
  }
  return cell;
}

describe('the head', () => {
  it('names the card Recent orders, says Newest first and links All orders to the Orders list', () => {
    renderCard(loaded());

    expect(screen.getByRole('heading', { level: 2, name: 'Recent orders' })).toBeVisible();
    expect(screen.getByText('Newest first')).toBeVisible();
    const all = screen.getByRole('link', { name: 'All orders' });
    expect(all).toHaveAttribute('href', '/admin/orders');
    expect(all.querySelector('svg.lucide-arrow-right')).not.toBeNull();
  });
});

describe('the table (DASH-05, D-38)', () => {
  it('names the table Recent orders and lists the seven columns, the last one a hidden Actions header', () => {
    renderCard(loaded());

    expect(screen.getByRole('table', { name: 'Recent orders' })).toBeVisible();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Order',
      'Customer / team',
      'Status',
      'Due',
      'Total',
      'Balance',
      'Actions',
    ]);
    expect(screen.getByText('Actions').className).toContain('h-px');
  });

  it('shows the six orders of the summary, newest first, as given', () => {
    renderCard(loaded());

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(
      within(table)
        .getAllByRole('link', { name: /^ORD-/ })
        .map((link) => link.textContent),
    ).toEqual(['ORD-2026-0148', 'ORD-2026-0151', 'ORD-2026-0153', 'ORD-2026-0160', 'ORD-2026-0150', 'ORD-2026-0139']);
  });

  it('links each order number to /admin/orders/{id}', () => {
    renderCard(loaded());

    expect(within(rowOf('ORD-2026-0148')).getByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      `/admin/orders/${orderId(148)}`,
    );
    expect(within(rowOf('ORD-2026-0153')).getByRole('link', { name: 'ORD-2026-0153' })).toHaveAttribute(
      'href',
      `/admin/orders/${orderId(153)}`,
    );
  });

  it('puts the team in bold over the customer, or the customer over "Walk-in customer" when there is no team', () => {
    renderCard(loaded());

    const withTeam = cellOf('ORD-2026-0148', 'Customer');
    expect(within(withTeam).getByText('Brgy. San Roque Ballers').tagName).toBe('STRONG');
    expect(within(withTeam).getByText('Juan Dela Cruz')).toBeVisible();
    const walkIn = cellOf('ORD-2026-0153', 'Customer');
    expect(within(walkIn).getByText('Angelica Santos').tagName).toBe('STRONG');
    expect(within(walkIn).getByText('Walk-in customer')).toBeVisible();
  });

  it('shows the status badge of each order and the raw text of a status it does not know', () => {
    const unknown = { ...listEntryOf(order0151), id: orderId(170), number: 'ORD-2026-0170', status: 'archived' };
    renderCard(loaded(summaryOf({ recentOrders: [...dashboardRecentOrders().slice(0, 2), unknown] })));

    expect(within(cellOf('ORD-2026-0148', 'Status')).getByText('In Production')).toBeVisible();
    expect(within(cellOf('ORD-2026-0151', 'Status')).getByText('Ready')).toBeVisible();
    expect(cellOf('ORD-2026-0170', 'Status')).toHaveTextContent('archived');
  });

  it('shows the total after discount', () => {
    renderCard(loaded());

    expect(cellOf('ORD-2026-0148', 'Total')).toHaveTextContent('₱21,327.50');
  });
});

describe('the Due column uses the summary business date (08 D-36 to D-38)', () => {
  it('flags an overdue Mockup order, counted from the summary date', () => {
    renderCard(loaded());

    const due = cellOf('ORD-2026-0153', 'Due');
    expect(within(due).getByText('Due Oct 5, 2026')).toBeVisible();
    expect(within(due).getByText('Overdue by 3 days')).toBeVisible();
  });

  it('flags an overdue Ready order too', () => {
    const readyOverdue = { ...listEntryOf(order0151), dueDate: '2026-10-05' };
    renderCard(loaded(summaryOf({ recentOrders: [readyOverdue] })));

    expect(within(cellOf('ORD-2026-0151', 'Due')).getByText('Overdue by 3 days')).toBeVisible();
  });

  it('does not flag a Delivered order past its due date', () => {
    renderCard(loaded());

    const due = cellOf('ORD-2026-0150', 'Due');
    expect(within(due).getByText('Due Oct 6, 2026')).toBeVisible();
    expect(within(due).queryByText(/Overdue/)).toBeNull();
  });

  it('counts days left from the summary date, not the device clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
    try {
      renderCard(loaded());

      expect(within(cellOf('ORD-2026-0148', 'Due')).getByText('6 days left')).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the Balance column (08 D-04, D-45)', () => {
  it('shows the due figure, Fully Paid, the credit badge and Not collected as the Orders list does', () => {
    renderCard(loaded());

    expect(cellOf('ORD-2026-0148', 'Balance')).toHaveTextContent('₱9,327.50');
    expect(cellOf('ORD-2026-0151', 'Balance')).toHaveTextContent('Fully Paid');
    expect(cellOf('ORD-2026-0160', 'Balance')).toHaveTextContent('Credit ₱1,000.00');
    const cancelled = cellOf('ORD-2026-0139', 'Balance');
    expect(cancelled).toHaveTextContent('₱5,500.00');
    expect(cancelled).toHaveTextContent('Not collected');
  });
});

describe('the eye link', () => {
  it('opens the order, named "View ORD-2026-0148" with the same title', () => {
    renderCard(loaded());

    const eye = within(rowOf('ORD-2026-0148')).getByRole('link', { name: 'View ORD-2026-0148' });
    expect(eye).toHaveAttribute('href', `/admin/orders/${orderId(148)}`);
    expect(eye).toHaveAttribute('title', 'View ORD-2026-0148');
    expect(eye.querySelector('svg.lucide-eye')).not.toBeNull();
  });
});

describe('phones', () => {
  it('labels every cell of every row, so the rows read as cards', () => {
    renderCard(loaded());

    const cells = Array.from(document.querySelectorAll('tbody td'));
    expect(cells).toHaveLength(6 * 7);
    expect(new Set(cells.map((cell) => cell.getAttribute('data-label')))).toEqual(
      new Set(['Order', 'Customer', 'Status', 'Due', 'Total', 'Balance', 'Actions']),
    );
  });
});

describe('with no orders (DASH-06)', () => {
  it('shows the empty state with no button', () => {
    renderCard(loaded(dashboardNewShopSummary()));

    expect(screen.getByRole('heading', { level: 3, name: 'No orders yet' })).toBeVisible();
    expect(screen.getByText('New orders show here, newest first.')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Recent orders' })).toBeVisible();
  });
});

describe('while the orders load', () => {
  it('shows six skeleton rows in a region announced as "Loading recent orders…"', () => {
    const { container } = renderCard(queryOf({ isPending: true }));

    expect(screen.getByRole('status')).toHaveTextContent('Loading recent orders…');
    expect(container.querySelectorAll('[aria-hidden="true"] tbody tr')).toHaveLength(6);
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('when the orders fail (DASH-06)', () => {
  it('shows its own alert and a Try Again that reads the summary again, and keeps no old rows', async () => {
    const refetch = vi.fn();
    renderCard(queryOf({ data: summaryOf(), isError: true, error: new Error('x'), refetch }));

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load recent orders.");
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('ORD-2026-0148')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('a one-line order', () => {
  it('shows an order with no due date as an empty value', () => {
    const noDue = buildOrderListEntry({ id: orderId(101), number: 'ORD-2026-0101', dueDate: null, status: 'pending' });
    renderCard(loaded(summaryOf({ recentOrders: [noDue] })));

    expect(cellOf('ORD-2026-0101', 'Due')).toHaveTextContent('Due');
    expect(within(cellOf('ORD-2026-0101', 'Due')).getByText('Not set')).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('has no axe violations loaded, empty, loading or failed', async () => {
    const loadedView = renderCard(loaded());
    await expectNoAxeViolations(loadedView.container);
    loadedView.unmount();

    const emptyView = renderCard(loaded(dashboardNewShopSummary()));
    await expectNoAxeViolations(emptyView.container);
    emptyView.unmount();

    const loadingView = renderCard(queryOf({ isPending: true }));
    await expectNoAxeViolations(loadingView.container);
    loadingView.unmount();

    const failedView = renderCard(queryOf({ isError: true }));
    await expectNoAxeViolations(failedView.container);
  });
});
