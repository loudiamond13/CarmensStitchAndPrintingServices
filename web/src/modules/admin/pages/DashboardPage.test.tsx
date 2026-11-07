import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { DashboardRoute } from '@/modules/admin/pages/DashboardPage';
import { dashboardBackend, dashboardNovemberSummary, dashboardSummaryFixture } from '@/test/dashboardFixtures';
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

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>
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

    expect(await screen.findByText('Active orders')).toBeVisible();
    expect(screen.getByText('Total receivables')).toBeVisible();
    expect(screen.getByText('Collected · Nov')).toBeVisible();
    expect(screen.getByText('Company expenses · Nov')).toBeVisible();
    expect(screen.getByText('5 due this week · 2 overdue')).toBeVisible();
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

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load the shop figures.");
    expect(screen.queryByText('Active orders')).toBeNull();
    const header = screen.getByRole('heading', { level: 1, name: 'Dashboard' }).parentElement?.parentElement;
    expect(header).not.toContainElement(alert);
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
    const { container } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText(/Here's how the shop is doing this month/)).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Good evening, Carmen' })).toBeVisible();
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
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

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

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
