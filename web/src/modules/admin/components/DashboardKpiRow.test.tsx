import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardKpiRow } from '@/modules/admin/components/DashboardKpiRow';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { expectNoAxeViolations } from '@/test/axe';
import {
  dashboardMarch31Summary,
  dashboardMondaySummary,
  dashboardNewShopSummary,
  dashboardNovemberSummary,
  dashboardSummaryFixture,
  dashboardSundaySummary,
  type DashboardSummaryFixture,
} from '@/test/dashboardFixtures';

// The four KPI cards of the dashboard (DASH-02, DASH-06, D-01 to D-07, D-37; plan 10-09): every figure and count is the
// server's, the browser only formats them, and the month names come from the summary's dates, never the device clock.

function queryOf(overrides: Partial<DashboardCardQuery> = {}): DashboardCardQuery {
  return { data: undefined, isPending: false, isError: false, error: null, refetch: vi.fn(), ...overrides };
}

function loaded(data: DashboardSummaryFixture = dashboardNovemberSummary()): DashboardCardQuery {
  return queryOf({ data });
}

/** The card of a KPI, found by its label. */
function cardOf(label: string): HTMLElement {
  const card = screen.getByText(label).parentElement?.parentElement;
  if (card === null || card === undefined) {
    throw new Error(`No card for ${label}`);
  }
  return card;
}

const NOVEMBER_LABELS = ['Active orders', 'Total receivables', 'Collected · Nov', 'Company expenses · Nov'];

afterEach(() => {
  vi.useRealTimers();
});

describe('the four cards (DASH-02, D-37)', () => {
  it('shows exactly four cards in order, with the figures of the summary and no profit card', () => {
    render(<DashboardKpiRow query={loaded()} />);

    const labels = screen
      .getAllByText(/^(Active orders|Total receivables|Collected · \w+|Company expenses · \w+|Profit.*)$/)
      .map((label) => label.textContent);
    expect(labels).toEqual(NOVEMBER_LABELS);
    expect(within(cardOf('Active orders')).getByText('18')).toBeVisible();
    expect(within(cardOf('Total receivables')).getByText('₱84,300.00')).toBeVisible();
    expect(within(cardOf('Collected · Nov')).getByText('₱126,450.00')).toBeVisible();
    expect(within(cardOf('Company expenses · Nov')).getByText('₱58,320.00')).toBeVisible();
  });

  it('reads the figures the generated types allow as text, too', () => {
    const data = dashboardNovemberSummary({
      orders: { active: '18', dueThisWeek: '5', overdue: '2', receivables: '84300' },
      collected: { thisMonth: '126450', comparison: '112900', changePercent: '12', comparisonThrough: '2026-10-04' },
      expenses: { thisMonth: '58320', count: '23', topCategory: 'Rent' },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    expect(within(cardOf('Active orders')).getByText('18')).toBeVisible();
    expect(within(cardOf('Active orders')).getByText('5 due this week · 2 overdue')).toBeVisible();
    expect(within(cardOf('Total receivables')).getByText('₱84,300.00')).toBeVisible();
    expect(within(cardOf('Collected · Nov')).getByText('12%')).toBeVisible();
    expect(within(cardOf('Company expenses · Nov')).getByText('23 entries · top: Rent')).toBeVisible();
  });

  it('gives each card its icon tile', () => {
    const { container } = render(<DashboardKpiRow query={loaded()} />);

    for (const icon of ['clipboard-list', 'wallet', 'trending-up', 'receipt']) {
      expect(container.querySelector(`svg.lucide-${icon}`), icon).not.toBeNull();
    }
  });
});

describe('the feet', () => {
  it('writes the owner wording for the 12.4 values', () => {
    render(<DashboardKpiRow query={loaded()} />);

    expect(within(cardOf('Active orders')).getByText('5 due this week · 2 overdue')).toBeVisible();
    expect(within(cardOf('Total receivables')).getByText('Unpaid balances, all active orders')).toBeVisible();
    const collected = cardOf('Collected · Nov');
    expect(within(collected).getByText('12%')).toBeVisible();
    expect(within(collected).getByRole('img', { name: 'Up' })).toBeVisible();
    expect(within(collected).getByText('vs Oct, same day')).toBeVisible();
    expect(within(cardOf('Company expenses · Nov')).getByText('23 entries · top: Rent')).toBeVisible();
  });

  it.each([
    [5, 2, '5 due this week · 2 overdue'],
    [5, 0, '5 due this week'],
    [0, 2, 'None due this week · 2 overdue'],
    [0, 0, 'None due this week'],
    [1, 1, '1 due this week · 1 overdue'],
    [1, 0, '1 due this week'],
    [0, 1, 'None due this week · 1 overdue'],
  ])('writes %i due and %i overdue as "%s" (D-01, D-02)', (dueThisWeek, overdue, foot) => {
    const data = dashboardNovemberSummary({ orders: { active: 18, dueThisWeek, overdue, receivables: 84300 } });
    render(<DashboardKpiRow query={loaded(data)} />);

    expect(within(cardOf('Active orders')).getByText(foot)).toBeVisible();
  });

  it.each([
    [23, 'Rent', '23 entries · top: Rent'],
    [2, 'Fabric', '2 entries · top: Fabric'],
    [1, 'Rent', '1 entry · top: Rent'],
    [1200, 'Rent', '1,200 entries · top: Rent'],
    [0, null, 'No expenses yet this month'],
  ])('writes %i expenses with top %s as "%s" (D-07)', (count, topCategory, foot) => {
    const data = dashboardNovemberSummary({ expenses: { thisMonth: 58320, count, topCategory } });
    render(<DashboardKpiRow query={loaded(data)} />);

    expect(within(cardOf('Company expenses · Nov')).getByText(foot)).toBeVisible();
  });

  it('leaves the top category out when entries exist but the server names none', () => {
    const data = dashboardNovemberSummary({ expenses: { thisMonth: 300, count: 3, topCategory: null } });
    render(<DashboardKpiRow query={loaded(data)} />);

    expect(within(cardOf('Company expenses · Nov')).getByText('3 entries')).toBeVisible();
  });

  it('shows the server percent with the Down arrow when the month is below last month', () => {
    const data = dashboardNovemberSummary({
      collected: { thisMonth: 100, comparison: 200, changePercent: -50, comparisonThrough: '2026-10-04' },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    const collected = cardOf('Collected · Nov');
    expect(within(collected).getByRole('img', { name: 'Down' })).toBeVisible();
    expect(within(collected).getByText('50%')).toBeVisible();
  });

  it('shows no percent and says nothing was collected when the server sends none (D-06)', () => {
    const data = dashboardNovemberSummary({
      collected: { thisMonth: 4000, comparison: 0, changePercent: null, comparisonThrough: '2026-10-04' },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    const collected = cardOf('Collected · Nov');
    expect(within(collected).getByText('Nothing collected by this day in Oct')).toBeVisible();
    expect(within(collected).queryByRole('img', { name: 'Up' })).toBeNull();
    expect(within(collected).queryByRole('img', { name: 'Down' })).toBeNull();
    expect(within(collected).queryByText(/%/)).toBeNull();
    expect(within(collected).queryByText(/same day/)).toBeNull();
  });

  it('keeps the percent but drops the comparison words when the comparison date is not a date', () => {
    const data = dashboardNovemberSummary({
      collected: { thisMonth: 4000, comparison: 100, changePercent: 9, comparisonThrough: 'soon' },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    const collected = cardOf('Collected · Nov');
    expect(within(collected).getByText('9%')).toBeVisible();
    expect(within(collected).queryByText(/same day/)).toBeNull();
  });

  it('shows no foot on the collected card when there is no percent and the comparison date is not a date', () => {
    const data = dashboardNovemberSummary({
      collected: { thisMonth: 4000, comparison: 0, changePercent: null, comparisonThrough: 'soon' },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    expect(within(cardOf('Collected · Nov')).queryByText(/Nothing collected/)).toBeNull();
  });
});

describe('the money figures', () => {
  it('writes a negative collected figure with the minus sign U+2212 (D-04)', () => {
    const data = dashboardNovemberSummary({
      collected: { thisMonth: -1200, comparison: 500, changePercent: -340, comparisonThrough: '2026-10-04' },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    expect(within(cardOf('Collected · Nov')).getByText('−₱1,200.00')).toBeVisible();
  });

  it('keeps the long-figure clamp on a very large figure', () => {
    const data = dashboardNovemberSummary({
      orders: { active: 18, dueThisWeek: 5, overdue: 2, receivables: 999_999_999.99 },
    });
    render(<DashboardKpiRow query={loaded(data)} />);

    const figure = within(cardOf('Total receivables')).getByText('₱999,999,999.99');
    expect(figure.className).toContain('13.5cqi');
  });
});

describe('a new shop (DASH-06)', () => {
  it('shows zeros in the dim, not empty states, with the zero-case feet', () => {
    render(<DashboardKpiRow query={loaded(dashboardNewShopSummary({ today: '2026-11-04' }))} />);

    const active = within(cardOf('Active orders')).getByText('0');
    expect(active.className).toContain('text-ink-subtle');
    for (const label of ['Total receivables', 'Collected · Nov', 'Company expenses · Nov']) {
      const figure = within(cardOf(label)).getByText('₱0.00');
      expect(figure.className, label).toContain('text-ink-subtle');
    }
    expect(within(cardOf('Active orders')).getByText('None due this week')).toBeVisible();
    expect(within(cardOf('Collected · Nov')).getByText('Nothing collected by this day in Sep')).toBeVisible();
    expect(within(cardOf('Company expenses · Nov')).getByText('No expenses yet this month')).toBeVisible();
    expect(screen.queryByText('Not set')).toBeNull();
  });
});

describe('the month names come from the summary (D-05)', () => {
  it('says Mar and Feb on Mar 31, where the server clamps the comparison to Feb 28, whatever the device clock says', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-12-25T10:00:00Z'));
    render(<DashboardKpiRow query={loaded(dashboardMarch31Summary())} />);

    expect(screen.getByText('Collected · Mar')).toBeVisible();
    expect(screen.getByText('Company expenses · Mar')).toBeVisible();
    expect(within(cardOf('Collected · Mar')).getByText('vs Feb, same day')).toBeVisible();
  });

  it('shows the server counts on a Monday as they are', () => {
    render(<DashboardKpiRow query={loaded(dashboardMondaySummary())} />);

    expect(screen.getByText('Collected · Nov')).toBeVisible();
    expect(within(cardOf('Active orders')).getByText('9')).toBeVisible();
    expect(within(cardOf('Active orders')).getByText('6 due this week')).toBeVisible();
    expect(within(cardOf('Total receivables')).getByText('₱15,250.50')).toBeVisible();
    expect(within(cardOf('Collected · Nov')).getByText('vs Oct, same day')).toBeVisible();
  });

  it('shows the server counts on a Sunday as they are', () => {
    render(<DashboardKpiRow query={loaded(dashboardSundaySummary())} />);

    expect(within(cardOf('Active orders')).getByText('1 due this week · 1 overdue')).toBeVisible();
    expect(within(cardOf('Collected · Nov')).getByRole('img', { name: 'Down' })).toBeVisible();
    expect(within(cardOf('Collected · Nov')).getByText('11%')).toBeVisible();
  });

  it('leaves the month off the labels when the business date is not a date', () => {
    render(<DashboardKpiRow query={loaded(dashboardSummaryFixture({ today: 'later' }))} />);

    expect(screen.getByText('Collected')).toBeVisible();
    expect(screen.getByText('Company expenses')).toBeVisible();
  });
});

describe('while the figures load', () => {
  it('shows four loading cards inside one region announced as "Loading the shop figures…"', () => {
    render(<DashboardKpiRow query={queryOf({ isPending: true })} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading the shop figures…');
    for (const label of ['Active orders', 'Total receivables', 'Collected', 'Company expenses']) {
      expect(cardOf(label), label).toHaveAttribute('aria-busy', 'true');
    }
    expect(screen.queryByText(/due this week/)).toBeNull();
  });
});

describe('when the figures fail (DASH-06)', () => {
  it('replaces the row with one alert and a Try Again that reads the summary again', async () => {
    const refetch = vi.fn();
    render(<DashboardKpiRow query={queryOf({ isError: true, error: new Error('x'), refetch })} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the shop figures.");
    expect(screen.queryByText('Active orders')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not keep yesterday figures next to the alert when a later read fails', () => {
    render(<DashboardKpiRow query={queryOf({ data: dashboardNovemberSummary(), isError: true })} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the shop figures.");
    expect(screen.queryByText('₱126,450.00')).toBeNull();
  });
});

describe('accessibility', () => {
  it('has no axe violations loaded, loading, on a new shop or failed', async () => {
    const loadedView = render(<DashboardKpiRow query={loaded()} />);
    await expectNoAxeViolations(loadedView.container);
    loadedView.unmount();

    const loadingView = render(<DashboardKpiRow query={queryOf({ isPending: true })} />);
    await expectNoAxeViolations(loadingView.container);
    loadingView.unmount();

    const newShopView = render(<DashboardKpiRow query={loaded(dashboardNewShopSummary())} />);
    await expectNoAxeViolations(newShopView.container);
    newShopView.unmount();

    const failedView = render(<DashboardKpiRow query={queryOf({ isError: true })} />);
    await expectNoAxeViolations(failedView.container);
  });
});
