import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { IncomeExpenseCard } from '@/modules/admin/components/IncomeExpenseCard';
import { dashboardChartBackend, dashboardChartFixture } from '@/test/dashboardFixtures';
import { expectNoAxeViolations } from '@/test/axe';

// D3 Income vs. expenses card (DASH-03, D-36, D-50): the chart of plan 10-04 fed by the chart endpoint, with the owner's words.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderCard(search = '') {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <IncomeExpenseCard />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

const OCT_NAME = 'Oct 2026: income ₱126,450.00, expenses ₱58,320.00, profit ₱68,130.00';

describe('the head and the legend (DASH-03, D-50)', () => {
  it('reads "Income vs. expenses" with the sub "Last 6 months"', async () => {
    dashboardChartBackend();
    renderCard();

    expect(await screen.findByRole('heading', { level: 2, name: 'Income vs. expenses' })).toBeVisible();
    expect(screen.getByText('Last 6 months')).toBeVisible();
  });

  it("reads the owner's three legend words", async () => {
    dashboardChartBackend();
    renderCard();

    expect(await screen.findByText('Income (payments minus refunds)')).toBeVisible();
    expect(screen.getByText('Expenses (company + orders)')).toBeVisible();
    expect(screen.getByText('Profit (income minus expenses)')).toBeVisible();
  });

  it('reads the tooltip words Income, Expenses and Profit over a hovered month (D-104)', async () => {
    dashboardChartBackend();
    renderCard();

    await userEvent.hover(await screen.findByRole('img', { name: OCT_NAME }));

    expect(screen.getByText('Income ₱126,450.00')).toBeVisible();
    expect(screen.getByText('Expenses ₱58,320.00')).toBeVisible();
    expect(screen.getByText('Profit ₱68,130.00')).toBeVisible();
  });
});

describe('the months (DASH-03, D-36)', () => {
  it('names the October group with income, expenses and the server profit', async () => {
    dashboardChartBackend();
    renderCard();

    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
  });

  it('draws six groups, oldest first, each with its short month under the bars', async () => {
    dashboardChartBackend();
    renderCard();

    const groups = await screen.findAllByRole('img', { name: /^(Jun|Jul|Aug|Sep|Oct|Nov) 2026:/ });
    expect(groups.map((group) => group.getAttribute('aria-label')?.slice(0, 8))).toEqual([
      'Jun 2026',
      'Jul 2026',
      'Aug 2026',
      'Sep 2026',
      'Oct 2026',
      'Nov 2026',
    ]);
    expect(groups.map((group) => within(group).getByText(/^[A-Z][a-z]{2}$/).textContent)).toEqual([
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
    ]);
  });

  it('reads the profit the server sent, never income minus expenses', async () => {
    dashboardChartBackend(
      dashboardChartFixture(6, {
        items: [{ month: '2026-11', income: 100, expenses: 40, profit: 999 }],
      }),
    );
    renderCard();

    expect(
      await screen.findByRole('img', { name: 'Nov 2026: income ₱100.00, expenses ₱40.00, profit ₱999.00' }),
    ).toBeInTheDocument();
  });

  it('takes the month names from the keys the server sent, not from the device clock', async () => {
    dashboardChartBackend(
      dashboardChartFixture(6, {
        items: [
          { month: '2031-02', income: 10, expenses: 5, profit: 5 },
          { month: '2031-03', income: 20, expenses: 5, profit: 15 },
        ],
      }),
    );
    renderCard();

    expect(await screen.findByRole('img', { name: /^Feb 2031:/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Mar 2031:/ })).toBeInTheDocument();
  });

  it('shows a negative profit with the minus sign U+2212', async () => {
    dashboardChartBackend(
      dashboardChartFixture(6, { items: [{ month: '2026-11', income: 1000, expenses: 5000, profit: -4000 }] }),
    );
    renderCard();

    expect(
      await screen.findByRole('img', { name: 'Nov 2026: income ₱1,000.00, expenses ₱5,000.00, profit −₱4,000.00' }),
    ).toBeInTheDocument();
  });

  it('reads figures that arrive as text', async () => {
    dashboardChartBackend(
      dashboardChartFixture(6, { items: [{ month: '2026-11', income: '1250.5', expenses: '250', profit: '1000.5' }] }),
    );
    renderCard();

    expect(
      await screen.findByRole('img', { name: 'Nov 2026: income ₱1,250.50, expenses ₱250.00, profit ₱1,000.50' }),
    ).toBeInTheDocument();
  });

  it('leaves out a month whose key it cannot read, and does not make one up', async () => {
    dashboardChartBackend(
      dashboardChartFixture(6, {
        items: [
          { month: 'soon', income: 10, expenses: 5, profit: 5 },
          { month: '2026-11', income: 20, expenses: 5, profit: 15 },
        ],
      }),
    );
    renderCard();

    expect(await screen.findAllByRole('img', { name: /income/ })).toHaveLength(1);
  });

  it('has no axe violations with the months drawn', async () => {
    dashboardChartBackend();
    const { container } = renderCard();

    await screen.findByRole('img', { name: OCT_NAME });
    await expectNoAxeViolations(container);
  });
});
