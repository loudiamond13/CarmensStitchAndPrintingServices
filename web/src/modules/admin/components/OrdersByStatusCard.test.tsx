import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrdersByStatusCard } from '@/modules/admin/components/OrdersByStatusCard';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { STATES_COPY } from '@/components/states/copy';
import { expectNoAxeViolations } from '@/test/axe';
import {
  dashboardNewShopSummary,
  dashboardNovemberSummary,
  type DashboardSummaryFixture,
} from '@/test/dashboardFixtures';

// Orders by status (DASH-04, D-08, 07 D-01; plan 10-09): six rows with the server's counts, a bar as wide as the count is to
// the largest count, and the active total from the server. Cancelled is never shown.

function queryOf(overrides: Partial<DashboardCardQuery> = {}): DashboardCardQuery {
  return { data: undefined, isError: false, error: null, refetch: vi.fn(), ...overrides };
}

function loaded(data: DashboardSummaryFixture = dashboardNovemberSummary()): DashboardCardQuery {
  return queryOf({ data });
}

const KEYS = ['pending', 'mockup', 'production', 'ready', 'delivered', 'completed'] as const;

/** Six status entries in the server's order from six counts. */
function statusesOf(counts: readonly [number, number, number, number, number, number]) {
  return KEYS.map((status, index) => ({ status, count: counts[index] ?? 0 }));
}

/** The six rows of the list. */
function rows(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

/** One row of the list, by its place. */
function rowAt(index: number): HTMLElement {
  const row = rows()[index];
  if (row === undefined) {
    throw new Error(`No row ${String(index)}`);
  }
  return row;
}

/** The bar fill of a row: the one element that carries the --bar-w property. */
function fillOf(row: HTMLElement): HTMLElement {
  const fill = Array.from(row.querySelectorAll<HTMLElement>('*')).find(
    (element) => element.style.getPropertyValue('--bar-w') !== '',
  );
  if (fill === undefined) {
    throw new Error('No bar fill in the row');
  }
  return fill;
}

describe('the head', () => {
  it('names the card Orders by status with the sub line', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Orders by status' })).toBeVisible();
    expect(screen.getByText('Open orders + completed this month')).toBeVisible();
  });
});

describe('the rows (DASH-04, D-08)', () => {
  it('lists Pending, Mockup, In Production, Ready, Delivered and Completed in that order with their counts', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    expect(rows().map((row) => row.textContent)).toEqual([
      'Pending4',
      'Mockup2',
      'In Production7',
      'Ready3',
      'Delivered2',
      'Completed this month11',
    ]);
  });

  it('keeps the order and the six rows when the server lists them in another order or adds a status', () => {
    const data = dashboardNovemberSummary({
      statuses: [
        { status: 'completed', count: 11 },
        { status: 'cancelled', count: 9 },
        { status: 'delivered', count: 2 },
        { status: 'ready', count: 3 },
        { status: 'production', count: 7 },
        { status: 'mockup', count: 2 },
        { status: 'pending', count: 4 },
        { status: 'archived', count: 5 },
      ],
    });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(rows()).toHaveLength(6);
    expect(rows().map((row) => row.textContent)).toEqual([
      'Pending4',
      'Mockup2',
      'In Production7',
      'Ready3',
      'Delivered2',
      'Completed this month11',
    ]);
    expect(screen.queryByText(/cancel/i)).toBeNull();
    expect(screen.queryByText(/archived/i)).toBeNull();
  });

  it('shows a status the server leaves out as 0 and reads counts sent as text', () => {
    const data = dashboardNovemberSummary({
      statuses: [
        { status: 'pending', count: '4' },
        { status: 'completed', count: '11' },
      ],
    });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(rows().map((row) => row.textContent)).toEqual([
      'Pending4',
      'Mockup0',
      'In Production0',
      'Ready0',
      'Delivered0',
      'Completed this month11',
    ]);
  });

  it('groups the digits of a count over 999', () => {
    const data = dashboardNovemberSummary({ statuses: statusesOf([1234, 0, 0, 0, 0, 0]) });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(within(rowAt(0)).getByText('1,234')).toBeVisible();
  });

  it('reads the Completed row as "Completed this month" and its count, through a visually hidden " this month"', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    const completed = rowAt(5);
    expect(completed).toHaveTextContent(/^Completed\s+this month\s*11$/);
    const hidden = within(completed).getByText('this month');
    expect(hidden.className).toContain('h-px');
    expect(hidden.textContent).toBe(' this month');
    expect(within(rowAt(0)).queryByText(/this month/)).toBeNull();
  });
});

describe('the bars', () => {
  it('sets each width to the count over the largest count through --bar-w: the largest fills 100%', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    expect(rows().map((row) => fillOf(row).style.getPropertyValue('--bar-w'))).toEqual([
      '36.36%',
      '18.18%',
      '63.64%',
      '27.27%',
      '18.18%',
      '100%',
    ]);
  });

  it('shows the track only for a 0: its fill is 0% wide', () => {
    const data = dashboardNovemberSummary({ statuses: statusesOf([0, 0, 5, 0, 0, 0]) });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(rows().map((row) => fillOf(row).style.getPropertyValue('--bar-w'))).toEqual([
      '0%',
      '0%',
      '100%',
      '0%',
      '0%',
      '0%',
    ]);
  });

  it('reads the width through w-(--bar-w), with no inline width, and hides the bar from assistive technology', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    for (const row of rows()) {
      const fill = fillOf(row);
      expect(fill.className).toContain('w-(--bar-w)');
      expect(fill.style.width).toBe('');
      expect(fill.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('fills Delivered with the accent and the other rows with their status colours', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    const fills = rows().map((row) => fillOf(row).className);
    expect(fills[0]).toContain('bg-(--status-pending)');
    expect(fills[1]).toContain('bg-(--status-mockup)');
    expect(fills[2]).toContain('bg-(--status-production)');
    expect(fills[3]).toContain('bg-(--status-ready)');
    expect(fills[4]).toContain('bg-accent');
    expect(fills[5]).toContain('bg-(--status-completed)');
  });
});

describe('the footer (07 D-01)', () => {
  it('reads "Active (Pending to Delivered)" with the server active count: 18 orders', () => {
    render(<OrdersByStatusCard query={loaded()} />);

    expect(screen.getByText('Active (Pending to Delivered)')).toBeVisible();
    expect(screen.getByText('18 orders')).toBeVisible();
  });

  it('says "1 order" for one active order', () => {
    const data = dashboardNovemberSummary({
      orders: { active: 1, dueThisWeek: 0, overdue: 0, receivables: 100 },
      statuses: statusesOf([1, 0, 0, 0, 0, 3]),
    });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(screen.getByText('1 order')).toBeVisible();
  });

  it('writes the server count, not a sum of the rows (no client arithmetic)', () => {
    const data = dashboardNovemberSummary({ orders: { active: 20, dueThisWeek: 0, overdue: 0, receivables: 0 } });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(screen.getByText('20 orders')).toBeVisible();
    expect(screen.queryByText('18 orders')).toBeNull();
  });

  it('writes 0 orders when only completed orders exist this month', () => {
    const data = dashboardNovemberSummary({
      orders: { active: 0, dueThisWeek: 0, overdue: 0, receivables: 0 },
      statuses: statusesOf([0, 0, 0, 0, 0, 6]),
    });
    render(<OrdersByStatusCard query={loaded(data)} />);

    expect(screen.getByText('0 orders')).toBeVisible();
  });
});

describe('a shop with no open orders (DASH-06)', () => {
  it('shows the empty state in place of the list, with no footer and no button', () => {
    render(<OrdersByStatusCard query={loaded(dashboardNewShopSummary())} />);

    expect(screen.getByRole('heading', { level: 3, name: 'No open orders' })).toBeVisible();
    expect(screen.getByText('New orders show here by status.')).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Active (Pending to Delivered)')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('while the counts load', () => {
  it('shows six skeleton rows in a region announced as "Loading order counts…"', () => {
    const { container } = render(<OrdersByStatusCard query={queryOf()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading order counts…');
    expect(container.querySelectorAll('.animate-csp-shimmer')).toHaveLength(6);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Orders by status' })).toBeVisible();
  });

  it('keeps its status and says "Order counts loaded." when the counts arrive', () => {
    const { rerender } = render(<OrdersByStatusCard query={queryOf()} />);
    const status = screen.getByRole('status');

    rerender(<OrdersByStatusCard query={loaded()} />);

    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent(STATES_COPY.loading.loaded('order counts'));
  });

  it('says the counts loaded for a new shop too', () => {
    const { rerender } = render(<OrdersByStatusCard query={queryOf()} />);

    rerender(<OrdersByStatusCard query={loaded(dashboardNewShopSummary())} />);

    expect(screen.getByRole('status')).toHaveTextContent('Order counts loaded.');
  });
});

describe('when the counts fail (DASH-06)', () => {
  it('shows its own alert and a Try Again that reads the summary again, under the same head', async () => {
    const refetch = vi.fn();
    render(<OrdersByStatusCard query={queryOf({ isError: true, error: new Error('x'), refetch })} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load order counts.");
    expect(screen.getByRole('heading', { level: 2, name: 'Orders by status' })).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not keep the old counts next to the alert when a later read fails', () => {
    render(<OrdersByStatusCard query={queryOf({ data: dashboardNovemberSummary(), isError: true })} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load order counts.");
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('accessibility', () => {
  it('has no axe violations loaded, empty, loading or failed', async () => {
    const loadedView = render(<OrdersByStatusCard query={loaded()} />);
    await expectNoAxeViolations(loadedView.container);
    loadedView.unmount();

    const emptyView = render(<OrdersByStatusCard query={loaded(dashboardNewShopSummary())} />);
    await expectNoAxeViolations(emptyView.container);
    emptyView.unmount();

    const loadingView = render(<OrdersByStatusCard query={queryOf()} />);
    await expectNoAxeViolations(loadingView.container);
    loadingView.unmount();

    const failedView = render(<OrdersByStatusCard query={queryOf({ isError: true })} />);
    await expectNoAxeViolations(failedView.container);
  });
});
