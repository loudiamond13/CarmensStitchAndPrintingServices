import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { DashboardRoute } from '@/modules/admin/pages/DashboardPage';
import {
  dashboardBackend,
  dashboardChartFixture,
  dashboardNewShopSummary,
  dashboardNovemberSummary,
  dashboardRecentOrders,
  dashboardSummaryFixture,
  RECENT_ORDERS_TODAY,
} from '@/test/dashboardFixtures';
import { myMoneyBackend, myMoneyNegativeFixture } from '@/test/moneyFixtures';
import { orderId } from '@/test/orderFixtures';
import { problemResponse } from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';

// D1 Dashboard header, /admin (DASH-01, DASH-06, D-13): the greeting, the business date and the two actions, all from the
// server's summary, never the device clock.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderPage(search = '') {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter>
          <DashboardRoute />
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

const EVENING = dashboardSummaryFixture({ today: '2026-11-04', greeting: 'evening', firstName: 'Carmen' });

describe('the loaded header (DASH-01)', () => {
  it('greets the person by name and reads the business date from the summary', async () => {
    dashboardBackend(EVENING);
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' })).toBeVisible();
    expect(screen.getByText("Wednesday, Nov 4, 2026 · Here's how the shop is doing this month.")).toBeVisible();
  });

  it.each([
    ['morning', 'Good morning, Lito'],
    ['afternoon', 'Good afternoon, Lito'],
    ['evening', 'Good evening, Lito'],
  ])('says %s from the summary greeting', async (greeting, title) => {
    dashboardBackend(dashboardSummaryFixture({ greeting, firstName: 'Lito' }));
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
  });

  it('keeps the title "Dashboard" and still shows the date when the greeting part is one the page does not know', async () => {
    const backend = dashboardBackend(dashboardSummaryFixture({ greeting: 'night' }));
    renderPage();

    expect(await screen.findByText(/^Tuesday, Oct 6, 2026 · Here's how the shop is doing this month\.$/)).toBeVisible();
    expect(backend.calls).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(screen.queryByText(/night/)).toBeNull();
  });

  it('shows View Orders as a link to the orders and New Order as the one primary link to the new order form', async () => {
    dashboardBackend(EVENING);
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' });
    expect(screen.getByRole('link', { name: 'View Orders' })).toHaveAttribute('href', '/admin/orders');
    const newOrder = screen.getByRole('link', { name: 'New Order' });
    expect(newOrder).toHaveAttribute('href', '/admin/orders/new');
    expect(newOrder.querySelector('svg')).not.toBeNull();
  });

  it('renders the first name as text, never as markup', async () => {
    dashboardBackend(dashboardSummaryFixture({ greeting: 'morning', firstName: '<img src=x onerror=alert(1)>' }));
    const { container } = renderPage();

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Good morning, <img src=x onerror=alert(1)>',
    });
    expect(heading).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
  });

  it('wraps a very long first name instead of cutting it off', async () => {
    const longName = 'Maria'.repeat(20);
    dashboardBackend(dashboardSummaryFixture({ greeting: 'morning', firstName: longName }));
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: `Good morning, ${longName}` });
    expect(heading.className).toContain('wrap-anywhere');
  });

  it('sets the document title to "Dashboard · CSPS Admin"', async () => {
    dashboardBackend(EVENING);
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('Dashboard · CSPS Admin');
    });
  });

  it('has no axe violations', async () => {
    dashboardBackend(EVENING);
    const { container } = renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' });
    await expectNoAxeViolations(container);
  });
});

describe('the KPI row under the header (DASH-02, plan 10-09)', () => {
  it('shows the four cards from the same summary that feeds the header', async () => {
    dashboardBackend(dashboardNovemberSummary());
    renderPage();

    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
    expect(screen.getByText('Active orders')).toBeVisible();
    expect(screen.getByText('Total receivables')).toBeVisible();
    expect(screen.getByText('Collected · Nov')).toBeVisible();
    expect(screen.getByText('Company expenses · Nov')).toBeVisible();
    expect(screen.getByText('₱126,450.00')).toBeVisible();
  });

  it('announces "Loading the shop figures…" while the summary loads', async () => {
    dashboardBackend(async () => {
      await delay(300);
      return dashboardNovemberSummary();
    });
    renderPage();

    expect(screen.getByText('Loading the shop figures…')).toBeInTheDocument();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
  });

  it('shows the failure line in the KPI row, not under the header', async () => {
    dashboardBackend(() => problemResponse(500));
    renderPage();

    const alert = (await screen.findByText("Couldn't load the shop figures.")).closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(screen.queryByText('Active orders')).toBeNull();
    const header = screen.getByRole('heading', { level: 1, name: 'Dashboard' }).parentElement?.parentElement;
    expect(header).not.toContainElement(alert as HTMLElement);
  });
});

describe('a summary the browser cannot read (WR-02)', () => {
  it('shows the failure line instead of a broken figure when a money figure is not a number', async () => {
    dashboardBackend(
      dashboardNovemberSummary({ orders: { active: 18, dueThisWeek: 5, overdue: 2, receivables: 'abc' } }),
    );
    renderPage();

    expect(await screen.findByText("Couldn't load the shop figures.")).toBeVisible();
    expect(screen.getByText("Couldn't load order counts.")).toBeVisible();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.queryByText('Active orders')).toBeNull();
  });
});

describe('the Orders by status card on the page (DASH-04, plan 10-09)', () => {
  it('shows the six rows and the active total from the same summary', async () => {
    dashboardBackend(dashboardNovemberSummary());
    renderPage();

    expect(await screen.findByText('18 orders')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Orders by status' })).toBeVisible();
    expect(screen.getByText('Active (Pending to Delivered)')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('announces "Loading order counts…" while the summary loads', async () => {
    dashboardBackend(async () => {
      await delay(300);
      return dashboardNovemberSummary();
    });
    renderPage();

    expect(screen.getByText('Loading order counts…')).toBeInTheDocument();
    expect(await screen.findByText('18 orders')).toBeVisible();
  });

  it('shows its own failure line next to the KPI row failure line when the summary fails', async () => {
    dashboardBackend(() => problemResponse(500));
    renderPage();

    expect(await screen.findByText("Couldn't load order counts.")).toBeVisible();
    expect(screen.getByText("Couldn't load the shop figures.")).toBeVisible();
    expect(screen.getByText("Couldn't load recent orders.")).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Try Again' })).toHaveLength(3);
  });
});

describe('the Income vs. expenses card on the page (DASH-03, plan 10-11)', () => {
  it('sits first in the row, before Orders by status, and draws the server months', async () => {
    dashboardBackend(dashboardNovemberSummary());
    renderPage();

    const chart = await screen.findByRole('heading', { level: 2, name: 'Income vs. expenses' });
    const status = screen.getByRole('heading', { level: 2, name: 'Orders by status' });
    expect(chart.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chart.closest('section')?.parentElement).toBe(status.closest('section')?.parentElement);
    expect(
      await screen.findByRole('img', {
        name: 'Oct 2026: income ₱126,450.00, expenses ₱58,320.00, profit ₱68,130.00',
      }),
    ).toBeInTheDocument();
  });

  it('asks the chart for 6 months by default', async () => {
    const backend = dashboardBackend(dashboardNovemberSummary());
    renderPage();

    await screen.findByRole('img', { name: /^Oct 2026:/ });
    expect(backend.chartCalls).toHaveLength(1);
    expect(backend.chartCalls[0]?.searchParams.get('months')).toBe('6');
  });

  it('asks the chart for 12 months when the URL says range=12m', async () => {
    const backend = dashboardBackend(dashboardNovemberSummary());
    renderPage('?range=12m');

    expect(await screen.findByText('Last 12 months')).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(12);
    });
    expect(backend.chartCalls.map((url) => url.searchParams.get('months'))).toEqual(['12']);
  });

  it('announces "Loading the chart…" while the chart loads', async () => {
    dashboardBackend(dashboardNovemberSummary(), async () => {
      await delay(300);
      return dashboardChartFixture(6);
    });
    renderPage();

    expect(screen.getByText('Loading the chart…')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /^Oct 2026:/ })).toBeVisible();
  });

  it('keeps the KPI row, the status card and Recent orders when the chart fails (DASH-06)', async () => {
    dashboardBackend(dashboardNovemberSummary({ recentOrders: dashboardRecentOrders() }), () => problemResponse(500));
    renderPage();

    expect(await screen.findByText("Couldn't load the chart.")).toBeVisible();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
    expect(screen.getByText('₱126,450.00')).toBeVisible();
    expect(screen.getByText('18 orders')).toBeVisible();
    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps the chart when the summary fails, and Try Again on the chart reads only the chart', async () => {
    let chartAnswered = 0;
    const backend = dashboardBackend(
      () => problemResponse(500),
      () => {
        chartAnswered += 1;
        return chartAnswered === 1 ? problemResponse(500) : dashboardChartFixture(6);
      },
    );
    renderPage();

    await screen.findByText("Couldn't load the shop figures.");
    await screen.findByText("Couldn't load the chart.");
    const card = screen.getByRole('heading', { level: 2, name: 'Income vs. expenses' }).closest('section');
    if (card === null) {
      throw new Error('No chart card');
    }
    await userEvent.click(within(card).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('img', { name: /^Oct 2026:/ })).toBeVisible();
    expect(backend.chartCalls).toHaveLength(2);
    expect(screen.getByText("Couldn't load the shop figures.")).toBeVisible();
    expect(backend.calls).toHaveLength(1);
  });
});

describe('the Recent orders card on the page (DASH-05, plan 10-09)', () => {
  it('lists the six newest orders from the same summary, under the status card', async () => {
    dashboardBackend(dashboardNovemberSummary({ today: RECENT_ORDERS_TODAY, recentOrders: dashboardRecentOrders() }));
    renderPage();

    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      `/admin/orders/${orderId(148)}`,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Recent orders' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/admin/orders');
    expect(screen.getByRole('table', { name: 'Recent orders' })).toBeVisible();
    const status = screen.getByRole('heading', { level: 2, name: 'Orders by status' });
    const recent = screen.getByRole('heading', { level: 2, name: 'Recent orders' });
    expect(status.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('announces "Loading recent orders…" while the summary loads', async () => {
    dashboardBackend(async () => {
      await delay(300);
      return dashboardNovemberSummary({ recentOrders: dashboardRecentOrders() });
    });
    renderPage();

    expect(screen.getByText('Loading recent orders…')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
  });

  it('shows the empty state on a new shop, with zeros in the KPI row and no open orders', async () => {
    dashboardBackend(dashboardNewShopSummary());
    renderPage();

    expect(await screen.findByRole('heading', { level: 3, name: 'No orders yet' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'No open orders' })).toBeVisible();
    expect(screen.getByText('None due this week')).toBeVisible();
  });

  it('brings all three cards back with one Try Again, which reads the summary once', async () => {
    let answered = 0;
    const backend = dashboardBackend(() => {
      answered += 1;
      return answered === 1
        ? problemResponse(500)
        : dashboardNovemberSummary({ recentOrders: dashboardRecentOrders() });
    });
    renderPage();

    await screen.findByText("Couldn't load recent orders.");
    const [retry] = screen.getAllByRole('button', { name: 'Try Again' });
    if (retry === undefined) {
      throw new Error('No Try Again button');
    }
    await userEvent.click(retry);

    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
    expect(screen.getByText('18 orders')).toBeVisible();
    expect(screen.getByText('5 due this week · 2 overdue')).toBeVisible();
    expect(backend.calls).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the summary query (D-13)', () => {
  it('is read again on every visit, not served from a fresh cache', async () => {
    const backend = dashboardBackend(EVENING);
    const first = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' });
    first.unmount();

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' });

    await waitFor(() => {
      expect(backend.calls).toHaveLength(2);
    });
    expect(queryClient.getQueryCache().find({ queryKey: dashboardKey, exact: false })).toBeDefined();
  });
});

describe('while the summary loads (DASH-06)', () => {
  it('shows the title "Dashboard" and a skeleton line instead of the date', async () => {
    dashboardBackend(async () => {
      await delay(300);
      return EVENING;
    });
    renderPage();

    // The cards below have their own skeletons and bars, so the header's skeleton is looked up inside the header.
    const headerOf = () => screen.getByRole('heading', { level: 1 }).parentElement;
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(headerOf()?.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText(/Here's how the shop is doing this month/)).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' })).toBeVisible();
    expect(headerOf()?.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it('still offers the two actions while it loads', () => {
    dashboardBackend(async () => {
      await delay(300);
      return EVENING;
    });
    renderPage();

    expect(screen.getByRole('link', { name: 'View Orders' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'New Order' })).toBeVisible();
  });
});

describe('when the summary fails (DASH-06)', () => {
  it('keeps the title "Dashboard", drops the date and offers Try Again, which reads the summary again', async () => {
    let answered = 0;
    const backend = dashboardBackend(() => {
      answered += 1;
      return answered === 1 ? problemResponse(500) : EVENING;
    });
    renderPage();

    expect(await screen.findByText("Couldn't load the shop figures.")).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(screen.queryByText(/Here's how the shop is doing this month/)).toBeNull();

    const [retry] = screen.getAllByRole('button', { name: 'Try Again' });
    if (retry === undefined) {
      throw new Error('No Try Again button');
    }
    await userEvent.click(retry);

    expect(await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' })).toBeVisible();
    expect(backend.calls).toHaveLength(2);
    expect(screen.queryByText("Couldn't load the shop figures.")).toBeNull();
  });

  it('has no axe violations in the error state', async () => {
    dashboardBackend(() => problemResponse(500));
    const { container } = renderPage();

    await screen.findByText("Couldn't load the shop figures.");
    await expectNoAxeViolations(container);
  });
});

describe('when a later refresh fails (D-111, P10-BL-04)', () => {
  const GOOD = dashboardNovemberSummary({ greeting: 'evening', firstName: 'Carmen' });
  const STALE_LINE = (time: string) => `Showing figures from ${time}. Couldn't refresh.`;

  // 2026-11-04 at 9:41 AM, 9:50 AM and 9:55 AM in Manila (UTC+8).
  const AT_941 = '2026-11-04T01:41:00Z';
  const AT_950 = '2026-11-04T01:50:00Z';
  const AT_955 = '2026-11-04T01:55:00Z';

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AT_941));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function refreshAt(instant: string) {
    vi.setSystemTime(new Date(instant));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardKey });
    });
  }

  it('keeps the greeting, the date, the figures, the status rows and the recent orders, and shows one alert with Try Again', async () => {
    let answered = 0;
    dashboardBackend(() => {
      answered += 1;
      return answered === 1 ? GOOD : problemResponse(500);
    });
    renderPage();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();

    await refreshAt(AT_955);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(STALE_LINE('9:41 AM'));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(alert.parentElement).toContainElement(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Good evening, Carmen' })).toBeVisible();
    expect(screen.getByText("Wednesday, Nov 4, 2026 · Here's how the shop is doing this month.")).toBeVisible();
    expect(screen.getByText('₱126,450.00')).toBeVisible();
    expect(screen.getByText('18 orders')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('ORD-2026-0148')).toBeVisible();
    expect(screen.queryByText(/Couldn't load/)).toBeNull();
  });

  it('names the last good load, not the first one', async () => {
    let answered = 0;
    dashboardBackend(() => {
      answered += 1;
      return answered <= 2 ? GOOD : problemResponse(500);
    });
    renderPage();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
    await refreshAt(AT_950);
    await refreshAt(AT_955);

    expect(await screen.findByRole('alert')).toHaveTextContent(STALE_LINE('9:50 AM'));
  });

  it('reads the summary again on Try Again: the line leaves when it works and comes back with the same time when it fails', async () => {
    let answered = 0;
    const backend = dashboardBackend(() => {
      answered += 1;
      return answered === 1 || answered === 4 ? GOOD : problemResponse(500);
    });
    renderPage();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
    await refreshAt(AT_950);
    expect(await screen.findByRole('alert')).toHaveTextContent(STALE_LINE('9:41 AM'));

    vi.setSystemTime(new Date(AT_955));
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => {
      expect(backend.calls).toHaveLength(3);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(STALE_LINE('9:41 AM'));

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(backend.calls).toHaveLength(4);
    expect(screen.getByText('₱126,450.00')).toBeVisible();
    expect(screen.queryByText(/Showing figures/)).toBeNull();
  });

  it('shows no stale line after a first-load failure, only each card its own alert', async () => {
    dashboardBackend(() => problemResponse(500));
    renderPage();

    expect(await screen.findByText("Couldn't load the shop figures.")).toBeVisible();
    expect(screen.queryByText(/Showing figures/)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  it('has no axe violations with the figures kept and the line shown', async () => {
    let answered = 0;
    dashboardBackend(() => {
      answered += 1;
      return answered === 1 ? GOOD : problemResponse(500);
    });
    const { container } = renderPage();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
    await refreshAt(AT_955);
    await screen.findByText(STALE_LINE('9:41 AM'));

    await expectNoAxeViolations(container);
  });
});

describe('the money strip on the page (MONEY-02, D-46, plan 10-13)', () => {
  it('sits after the header and before the KPI row, with the caller own figure and a link to the ledger', async () => {
    dashboardBackend(dashboardNovemberSummary());
    myMoneyBackend();
    renderPage();

    const label = await screen.findByText('Your money on hand');
    expect(await screen.findByText('₱8,450.00')).toBeVisible();
    const title = screen.getByRole('heading', { level: 1 });
    const kpi = await screen.findByText('Active orders');
    expect(title.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.compareDocumentPosition(kpi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View Ledger' })).toHaveAttribute('href', '/admin/money');
  });

  it('keeps the strip alive when the summary fails, and the KPI row alive when the money fails', async () => {
    dashboardBackend(() => problemResponse(500));
    myMoneyBackend();
    const { unmount } = renderPage();

    expect(await screen.findByText('₱8,450.00')).toBeVisible();
    expect(await screen.findByText("Couldn't load the shop figures.")).toBeVisible();
    unmount();
    queryClient.clear();

    dashboardBackend(dashboardNovemberSummary());
    myMoneyBackend(() => problemResponse(500));
    renderPage();

    expect(await screen.findByText("Couldn't load your money on hand.")).toBeVisible();
    expect(await screen.findByText('5 due this week · 2 overdue')).toBeVisible();
  });

  it('shows a negative balance in the danger tone', async () => {
    dashboardBackend(dashboardNovemberSummary());
    myMoneyBackend(myMoneyNegativeFixture());
    renderPage();

    expect((await screen.findByText('−₱500.00')).className).toContain('text-danger');
  });

  it('reads the money again on every visit (D-13)', async () => {
    dashboardBackend(dashboardNovemberSummary());
    const calls = myMoneyBackend();
    const first = renderPage();
    await screen.findByText('₱8,450.00');
    first.unmount();

    renderPage();
    await screen.findByText('₱8,450.00');

    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
  });

  it('has no axe violations with the strip drawn', async () => {
    dashboardBackend(dashboardNovemberSummary());
    myMoneyBackend();
    const { container } = renderPage();

    await screen.findByText('₱8,450.00');
    await screen.findByText('5 due this week · 2 overdue');
    await expectNoAxeViolations(container);
  });
});
