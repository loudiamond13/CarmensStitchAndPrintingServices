import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { IncomeExpenseCard } from '@/modules/admin/components/IncomeExpenseCard';
import {
  dashboardChartBackend,
  dashboardChartEmptyFixture,
  dashboardChartFixture,
  type DashboardChartFixture,
} from '@/test/dashboardFixtures';
import { problemResponse } from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';

// D3 Income vs. expenses card (DASH-03, D-36, D-50): the chart of plan 10-04 fed by the chart endpoint, with the owner's words.

type DashboardChartItem = DashboardChartFixture['items'][number];

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderCard(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
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

    expect((await screen.findAllByRole('img', { name: /income/ })).length).toBe(1);
  });

  it('has no axe violations with the months drawn', async () => {
    dashboardChartBackend();
    const { container } = renderCard();

    await screen.findByRole('img', { name: OCT_NAME });
    await expectNoAxeViolations(container);
  });
});

describe('the range switch (DASH-03, WEB-10)', () => {
  it('offers 6M and 12M in a group named Range, with 6M checked', async () => {
    dashboardChartBackend();
    renderCard();

    const group = await screen.findByRole('radiogroup', { name: 'Range' });
    const [six, twelve] = within(group).getAllByRole('radio');
    expect(six).toHaveAccessibleName('6M');
    expect(six).toBeChecked();
    expect(twelve).toHaveAccessibleName('12M');
    expect(twelve).not.toBeChecked();
  });

  it('asks for 6 months first', async () => {
    const calls = dashboardChartBackend();
    renderCard();

    await screen.findByRole('img', { name: OCT_NAME });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.searchParams.get('months')).toBe('6');
  });

  it('starts on 12 months when the URL says range=12m', async () => {
    const calls = dashboardChartBackend();
    renderCard('?range=12m');

    expect(await screen.findByText('Last 12 months')).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(12);
    });
    expect(calls.map((url) => url.searchParams.get('months'))).toEqual(['12']);
    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();
  });

  it('asks for 12 months on 12M, says "Last 12 months", writes range=12m with a replace and keeps focus on the segment', async () => {
    const calls = dashboardChartBackend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderCard('', onUrlUpdate);
    await screen.findByRole('img', { name: OCT_NAME });

    const twelve = screen.getByRole('radio', { name: '12M' });
    await userEvent.click(twelve);

    expect(await screen.findByText('Last 12 months')).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(12);
    });
    expect(calls.map((url) => url.searchParams.get('months'))).toEqual(['6', '12']);
    expect(twelve).toHaveFocus();
    expect(twelve).toBeChecked();
    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toBe('?range=12m');
    expect(event?.options.history).toBe('replace');
  });

  it('keeps the last six months on screen, dimmed after 200 ms, until the twelve arrive', async () => {
    dashboardChartBackend(async (url) => {
      if (url.searchParams.get('months') === '12') await delay(700);
      return dashboardChartFixture(url.searchParams.get('months') === '12' ? 12 : 6);
    });
    renderCard();
    const oct = await screen.findByRole('img', { name: OCT_NAME });
    const body = oct.closest('figure')?.parentElement;

    await userEvent.click(screen.getByRole('radio', { name: '12M' }));

    expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(6);
    expect(body?.getAttribute('data-refetching')).toBeNull();
    await waitFor(() => {
      expect(body?.getAttribute('data-refetching')).toBe('true');
    });
    expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(6);
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(12);
    });
    expect(
      screen
        .getByRole('img', { name: /^Dec 2025:/ })
        .closest('figure')
        ?.parentElement?.getAttribute('data-refetching'),
    ).toBeNull();
  });

  it('keeps "Last 6 months" until the twelve arrive, then reads "Last 12 months" (D-107)', async () => {
    dashboardChartBackend(async (url) => {
      if (url.searchParams.get('months') === '12') await delay(700);
      return dashboardChartFixture(url.searchParams.get('months') === '12' ? 12 : 6);
    });
    const { container } = renderCard();
    await screen.findByRole('img', { name: OCT_NAME });

    await userEvent.click(screen.getByRole('radio', { name: '12M' }));

    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();
    expect(screen.getByText('Last 6 months')).toBeVisible();
    expect(screen.queryByText('Last 12 months')).toBeNull();
    await expectNoAxeViolations(container);
    expect(await screen.findByText('Last 12 months')).toBeVisible();
    expect(screen.queryByText('Last 6 months')).toBeNull();
  });

  it('keeps the empty message for 6 months, dims it by colour after 200 ms, and names 12 once they arrive (D-107)', async () => {
    dashboardChartBackend(async (url) => {
      if (url.searchParams.get('months') === '12') await delay(700);
      return dashboardChartEmptyFixture(url.searchParams.get('months') === '12' ? 12 : 6);
    });
    const { container } = renderCard();
    const title = await screen.findByRole('heading', { level: 3, name: 'No money in or out yet' });
    const wrapper = title.parentElement?.parentElement;
    expect(wrapper).toBeInstanceOf(HTMLElement);

    await userEvent.click(screen.getByRole('radio', { name: '12M' }));

    expect(screen.getByText('Payments and expenses from the last 6 months show here.')).toBeVisible();
    expect(wrapper?.getAttribute('data-refetching')).toBeNull();
    await waitFor(() => {
      expect(wrapper?.getAttribute('data-refetching')).toBe('true');
    });
    expect(wrapper?.className).toContain('data-[refetching=true]:bg-surface-2');
    expect(wrapper?.className).not.toContain('opacity');
    expect(screen.getByText('Payments and expenses from the last 6 months show here.')).toBeVisible();
    await expectNoAxeViolations(container);
    expect(await screen.findByText('Payments and expenses from the last 12 months show here.')).toBeVisible();
    expect(
      screen
        .getByRole('heading', { level: 3, name: 'No money in or out yet' })
        .parentElement?.parentElement?.getAttribute('data-refetching'),
    ).toBeNull();
  });

  it('does not dim when the new months arrive within 200 ms', async () => {
    dashboardChartBackend();
    renderCard();
    const body = (await screen.findByRole('img', { name: OCT_NAME })).closest('figure')?.parentElement;

    await userEvent.click(screen.getByRole('radio', { name: '12M' }));
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(12);
    });

    expect(body?.getAttribute('data-refetching')).toBeNull();
  });
});

describe('the card states (DASH-06)', () => {
  it('shows a 220 px skeleton in "Loading the chart…" on the first load', async () => {
    dashboardChartBackend(async () => {
      await delay(300);
      return dashboardChartFixture(6);
    });
    const { container } = renderCard();

    expect(screen.getByText('Loading the chart…')).toBeInTheDocument();
    const skeleton = container.querySelector('[aria-busy="true"] span[aria-hidden="true"]');
    expect(skeleton).not.toBeNull();
    expect((skeleton as HTMLElement).style.getPropertyValue('--sk-h')).toBe('220px');
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeVisible();
    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
    expect(await screen.findByText('The chart loaded.')).toBeInTheDocument();
  });

  it('shows "No money in or out yet" when every month is ₱0.00, with no button and the range switch', async () => {
    dashboardChartBackend(dashboardChartEmptyFixture(6));
    renderCard();

    expect(await screen.findByRole('heading', { level: 3, name: 'No money in or out yet' })).toBeVisible();
    expect(screen.getByText('Payments and expenses from the last 6 months show here.')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('img', { name: /income/ })).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeVisible();
  });

  it('says 12 months in the empty message on 12M', async () => {
    dashboardChartBackend(dashboardChartEmptyFixture(12));
    renderCard('?range=12m');

    expect(await screen.findByText('Payments and expenses from the last 12 months show here.')).toBeVisible();
  });

  it('draws the chart, not the empty state, when only one month has money', async () => {
    const empty = dashboardChartEmptyFixture(6);
    dashboardChartBackend({
      ...empty,
      items: empty.items.map((item, index) => (index === 2 ? { ...item, expenses: 1, profit: -1 } : item)),
    });
    renderCard();

    expect((await screen.findAllByRole('img', { name: /income/ })).length).toBe(6);
    expect(screen.queryByText('No money in or out yet')).toBeNull();
  });

  it('shows "Couldn\'t load the chart." with Try Again, and Try Again reads the chart again', async () => {
    let answered = 0;
    const calls = dashboardChartBackend(() => {
      answered += 1;
      return answered === 1 ? problemResponse(500) : dashboardChartFixture(6);
    });
    renderCard();

    const alert = (await screen.findByText("Couldn't load the chart.")).closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
    expect(calls).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps one status: silent on the failure, "Loading the chart…" during Try Again, then "The chart loaded."', async () => {
    let answered = 0;
    dashboardChartBackend(async () => {
      answered += 1;
      if (answered === 1) return problemResponse(500);
      await delay(300);
      return dashboardChartFixture(6);
    });
    renderCard();
    await screen.findByText("Couldn't load the chart.");
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(status).toHaveTextContent('Loading the chart…');
    });
    expect(status.previousElementSibling).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('The chart loaded.');
    expect(status.previousElementSibling).not.toHaveAttribute('aria-busy');
  });

  it('says it is busy and then that the chart loaded when Try Again follows a failed 12 months', async () => {
    let twelve = 0;
    dashboardChartBackend(async (url) => {
      if (url.searchParams.get('months') !== '12') return dashboardChartFixture(6);
      twelve += 1;
      if (twelve === 1) return problemResponse(500);
      await delay(300);
      return dashboardChartFixture(12);
    });
    renderCard();
    await screen.findByRole('img', { name: OCT_NAME });
    await userEvent.click(screen.getByRole('radio', { name: '12M' }));
    await screen.findByText("Couldn't load the chart.");
    const status = screen.getByRole('status');

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(status).toHaveTextContent('Loading the chart…');
    });
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /income/ }).length).toBe(12);
    });
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('The chart loaded.');
  });

  it('shows the failure when the 12 months cannot be read, and the switch still works', async () => {
    dashboardChartBackend((url) =>
      url.searchParams.get('months') === '12' ? problemResponse(500) : dashboardChartFixture(6),
    );
    renderCard();
    await screen.findByRole('img', { name: OCT_NAME });

    await userEvent.click(screen.getByRole('radio', { name: '12M' }));
    expect(await screen.findByText("Couldn't load the chart.")).toBeVisible();

    await userEvent.click(screen.getByRole('radio', { name: '6M' }));
    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
  });

  it('has no axe violations while loading, empty, failed and drawn', async () => {
    dashboardChartBackend(async () => {
      await delay(200);
      return dashboardChartFixture(6);
    });
    const loading = renderCard();
    await expectNoAxeViolations(loading.container);
    await screen.findByRole('img', { name: OCT_NAME });
    await expectNoAxeViolations(loading.container);
    loading.unmount();

    queryClient.clear();
    dashboardChartBackend(dashboardChartEmptyFixture(6));
    const empty = renderCard();
    await screen.findByRole('heading', { level: 3, name: 'No money in or out yet' });
    await expectNoAxeViolations(empty.container);
    empty.unmount();

    queryClient.clear();
    dashboardChartBackend(() => problemResponse(500));
    const failed = renderCard();
    await screen.findByText("Couldn't load the chart.");
    await expectNoAxeViolations(failed.container);
  });
});

describe('an answer the browser cannot draw (DASH-03, wave 5 IN-01)', () => {
  const bad: [string, DashboardChartItem][] = [
    ['text that is not a number', { month: '2026-11', income: 'abc', expenses: 5, profit: 5 }],
    ['grouped text', { month: '2026-11', income: '1,250.50', expenses: 5, profit: 5 }],
    ['blank text', { month: '2026-11', income: 10, expenses: '', profit: 5 }],
    ['Infinity as text', { month: '2026-11', income: 10, expenses: 5, profit: 'Infinity' }],
    ['NaN as text', { month: '2026-11', income: 'NaN', expenses: 5, profit: 5 }],
    ['a missing figure', { month: '2026-11', income: 10, expenses: 5, profit: null as never }],
  ];

  it.each(bad)('shows the failure and draws nothing for %s', async (_name, item) => {
    dashboardChartBackend(dashboardChartFixture(6, { items: [item] }));
    renderCard();

    expect(await screen.findByText("Couldn't load the chart.")).toBeVisible();
    expect(screen.queryByRole('img', { name: /income/ })).toBeNull();
    expect(document.body.innerHTML).not.toContain('NaN');
  });

  it('shows the failure when the server answers another window than the one asked for', async () => {
    dashboardChartBackend(dashboardChartFixture(12, { months: 12 }));
    renderCard();

    expect(await screen.findByText("Couldn't load the chart.")).toBeVisible();
    expect(screen.queryByRole('img', { name: /income/ })).toBeNull();
  });

  it('shows the failure when the server months is not a whole 6 or 12', async () => {
    dashboardChartBackend(dashboardChartFixture(6, { months: 6.5 }));
    renderCard();

    expect(await screen.findByText("Couldn't load the chart.")).toBeVisible();
  });

  it('reads the server months when it arrives as text', async () => {
    dashboardChartBackend(dashboardChartFixture(6, { months: '6' }));
    renderCard();

    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
  });

  it('draws the chart when Try Again meets a good answer after a bad one', async () => {
    let answered = 0;
    dashboardChartBackend(() => {
      answered += 1;
      return answered === 1
        ? dashboardChartFixture(6, { items: [{ month: '2026-11', income: 'abc', expenses: 5, profit: 5 }] })
        : dashboardChartFixture(6);
    });
    renderCard();
    await screen.findByText("Couldn't load the chart.");

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('img', { name: OCT_NAME })).toBeInTheDocument();
  });
});
