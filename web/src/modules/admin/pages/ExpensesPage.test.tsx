import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { badgeToneClasses } from '@/components/status/status.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { expensesDeletedKey } from '@/modules/admin/hooks/useDeletedExpensesQuery';
import { expenseKpisKey } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { ExpensesRoute } from '@/modules/admin/pages/ExpensesPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  CARMEN,
  categoriesBackend,
  createExpenseBackend,
  expenseDetail,
  expenseDetailBackend,
  deleteExpenseBackend,
  purgeExpenseBackend,
  updateExpenseBackend,
  RENT,
  staffBackend,
  EXPENSE_CATEGORIES,
  expenseItem,
  expenseKpis,
  expenseList,
  expensesBackend,
  kpisBackend,
  LONG_DESCRIPTION,
  LONG_NAME,
  PAOLO,
  problemResponse,
  RETIRED_CATEGORY_ID,
  SUPPLIES,
  actor,
} from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';

// E1 Company Expenses, /admin/expenses (CEXP-01, CEXP-04, CEXP-05, D-23, D-25; plan 06-04): the server's rows, paged, with
// the server's period total in the footer.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function Harness({ search, onUrlUpdate }: { search: string; onUrlUpdate: OnUrlUpdateFunction }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter>
          <ToastProvider>
            <ExpensesRoute />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(<Harness search={search} onUrlUpdate={onUrlUpdate} />);
}

const ROWS = [
  expenseItem('00000000-0000-4000-8000-000000000001', {
    date: '2026-10-06',
    description: 'Shop rent for October',
    amount: 12450,
    category: { id: 'c1', name: 'Rent', tone: 'accent', retired: false },
  }),
  expenseItem('00000000-0000-4000-8000-000000000002', {
    date: '2026-10-05',
    description: 'Thread and needles',
    amount: 640.5,
    category: SUPPLIES,
    paidBy: PAOLO,
    recordedBy: CARMEN,
  }),
];

function rowOf(text: string): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText(text) !== null);
  if (row === undefined) {
    throw new Error(`No row for ${text}`);
  }
  return row;
}

function cellOf(row: HTMLElement, label: string): HTMLElement {
  const cell = row.querySelector<HTMLElement>(`td[data-label="${label}"]`);
  if (cell === null) {
    throw new Error(`No ${label} cell`);
  }
  return cell;
}

describe('the page', () => {
  it('shows the header, the result bar, the table name and the seven column headers', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Company Expenses' })).toBeVisible();
    expect(
      screen.getByText(
        'General business costs like rent, bills, payroll and supplies. Costs for a specific order go inside that order.',
      ),
    ).toBeVisible();
    const table = await screen.findByRole('table', { name: 'Company expenses' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Date', 'Category', 'Description', 'Amount', 'Paid by', 'Recorded by', 'Actions']);
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 2 expenses · newest first');
    expect(document.title).toBe('Company Expenses · CSPS Admin');
  });

  it('shows one row per item: bold date, category, description, amount, Paid by and Recorded by', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();

    await screen.findByText('Shop rent for October');
    const rent = rowOf('Shop rent for October');
    expect(cellOf(rent, 'Date').textContent).toBe('Oct 6, 2026');
    expect(within(cellOf(rent, 'Date')).getByText('Oct 6, 2026').tagName).toBe('STRONG');
    expect(cellOf(rent, 'Category').textContent).toBe('Rent');
    expect(cellOf(rent, 'Amount').textContent).toBe('₱12,450.00');
    expect(cellOf(rent, 'Paid by').textContent).toContain('Carmen Reyes');
    expect(cellOf(rent, 'Recorded by').textContent).toContain('Carmen Reyes');

    const thread = rowOf('Thread and needles');
    expect(cellOf(thread, 'Amount').textContent).toBe('₱640.50');
    expect(cellOf(thread, 'Paid by').textContent).toContain('Paolo Garcia');
    expect(cellOf(thread, 'Recorded by').textContent).toContain('Carmen Reyes');
  });

  it("asks for the page and size only: the window is the server's, never the device clock's", async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    renderPage();

    await screen.findByText('Shop rent for October');
    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({ page: '1', pageSize: '20' });
  });

  it("shows the server's period total and window in the footer, not the sum of the rows on screen", async () => {
    expensesBackend(expenseList(ROWS, { total: 45, periodTotal: 99999.5 }));
    renderPage();

    await screen.findByText('Shop rent for October');
    const table = screen.getByRole('table', { name: 'Company expenses' });
    const foot = table.querySelector('tfoot');
    expect(foot).not.toBeNull();
    expect(foot?.textContent).toContain('45 expenses · Sep 25, 2026 to Nov 24, 2026');
    const total = foot?.querySelector<HTMLElement>('td[data-label="Total"]');
    expect(total?.textContent).toBe('₱99,999.50');
  });

  it('says 1 expense in the result bar and the footer for exactly one', async () => {
    expensesBackend(expenseList(ROWS.slice(0, 1)));
    renderPage();

    await screen.findByText('Shop rent for October');
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 1 expense · newest first');
    const foot = screen.getByRole('table', { name: 'Company expenses' }).querySelector('tfoot');
    expect(foot?.textContent).toContain('1 expense · Sep 25, 2026 to Nov 24, 2026');
  });

  it('shows the caption that says the total covers every page and deleted expenses never count', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();

    await screen.findByText('Shop rent for October');
    expect(
      screen.getByText('The total covers every page of this list for the filters above. Deleted expenses never count.'),
    ).toBeVisible();
  });

  it('wraps a 200-character description and a 100-character staff name in their cells', async () => {
    expensesBackend(
      expenseList([
        expenseItem('00000000-0000-4000-8000-000000000009', {
          description: LONG_DESCRIPTION,
          paidBy: actor(LONG_NAME, { formerStaff: true }),
        }),
      ]),
    );
    renderPage();

    const description = await screen.findByText(LONG_DESCRIPTION);
    expect(description.className).toContain('wrap-anywhere');
    const row = rowOf(LONG_DESCRIPTION);
    expect(cellOf(row, 'Paid by').className + cellOf(row, 'Paid by').innerHTML).toContain('wrap-anywhere');
  });

  it('renders text only: markup in a description or a name is shown as typed', async () => {
    expensesBackend(
      expenseList([
        expenseItem('00000000-0000-4000-8000-00000000000a', {
          description: '<img src=x onerror=alert(1)>',
          paidBy: actor('<b>Eve</b>'),
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByText(/<b>Eve<\/b>/)).toBeVisible();
  });

  it('has no axe violations with rows and the footer', async () => {
    expensesBackend(expenseList(ROWS));
    const { container } = renderPage();

    await screen.findByText('Shop rent for October');
    await expectNoAxeViolations(container);
  });
});

describe('paging in the URL', () => {
  it('asks for page 2 when the URL says page=2', async () => {
    const { calls } = expensesBackend(expenseList(ROWS, { page: 2, total: 45 }));
    renderPage('?page=2');

    await screen.findByText('Shop rent for October');
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({ page: '2', pageSize: '20' });
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
  });

  it('Next pushes the next page into the URL and asks the server for it', async () => {
    const user = userEvent.setup();
    const updates: string[] = [];
    const { calls } = expensesBackend((url) =>
      expenseList(ROWS, { page: Number(url.searchParams.get('page')), total: 45 }),
    );
    renderPage('', (event) => {
      updates.push(`${event.options.history}:${event.queryString}`);
    });

    await screen.findByText('Shop rent for October');
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
    });
    expect(updates).toContain('push:?page=2');
    expect(calls.at(-1)?.searchParams.get('page')).toBe('2');
  });

  it('a page size change asks for that size and goes back to page 1', async () => {
    const user = userEvent.setup();
    const { calls } = expensesBackend((url) =>
      expenseList(ROWS, { pageSize: Number(url.searchParams.get('pageSize')), total: 120 }),
    );
    renderPage('?page=2');

    await screen.findByText('Shop rent for October');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1 of 3');
    });
    expect(Object.fromEntries(calls.at(-1)?.searchParams ?? [])).toEqual({ page: '1', pageSize: '50' });
  });
});

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function hasTone(badge: HTMLElement, tone: keyof typeof badgeToneClasses): boolean {
  return tokens(badgeToneClasses[tone]).every((token) => tokens(badge.className).includes(token));
}

describe('how each row reads', () => {
  it('marks an expense dated after the response today as Upcoming, with the clock icon, and no other', async () => {
    expensesBackend(
      expenseList([
        expenseItem('00000000-0000-4000-8000-000000000011', { date: '2026-10-26', description: 'Later bill' }),
        expenseItem('00000000-0000-4000-8000-000000000012', { date: '2026-10-25', description: 'Today bill' }),
        expenseItem('00000000-0000-4000-8000-000000000013', { date: '2026-10-24', description: 'Earlier bill' }),
      ]),
    );
    renderPage();

    await screen.findByText('Later bill');
    const upcoming = screen.getAllByText('Upcoming');
    expect(upcoming).toHaveLength(1);
    expect(within(rowOf('Later bill')).getByText('Upcoming')).toBe(upcoming[0]);
    expect(upcoming[0]?.querySelector('svg.lucide-clock')).not.toBeNull();
    expect(hasTone(upcoming[0] ?? document.body, 'info')).toBe(true);
    expect(within(rowOf('Today bill')).queryByText('Upcoming')).toBeNull();
    expect(within(rowOf('Earlier bill')).queryByText('Upcoming')).toBeNull();
  });

  it('judges Upcoming by the response today, not by the device clock', async () => {
    expensesBackend(
      expenseList(
        [expenseItem('00000000-0000-4000-8000-000000000014', { date: '2030-01-01', description: 'Far away' })],
        { today: '2031-01-01' },
      ),
    );
    renderPage();

    await screen.findByText('Far away');
    expect(screen.queryByText('Upcoming')).toBeNull();
  });

  it('shows the category in the tone the server sends, and an unknown tone as neutral', async () => {
    expensesBackend(
      expenseList([
        expenseItem('00000000-0000-4000-8000-000000000015', { description: 'Known tone', category: SUPPLIES }),
        expenseItem('00000000-0000-4000-8000-000000000016', {
          description: 'Odd tone',
          category: { id: 'c9', name: 'Mystery', tone: 'danger', retired: false },
        }),
      ]),
    );
    renderPage();

    await screen.findByText('Known tone');
    const known = within(cellOf(rowOf('Known tone'), 'Category')).getByText('Supplies');
    expect(hasTone(known, 'warning')).toBe(true);
    const odd = within(cellOf(rowOf('Odd tone'), 'Category')).getByText('Mystery');
    expect(hasTone(odd, 'neutral')).toBe(true);
    expect(hasTone(odd, 'danger')).toBe(false);
  });

  it('keeps a deleted payer or recorder by name with the muted (former staff) suffix, and names System for no recorder', async () => {
    expensesBackend(
      expenseList([
        expenseItem('00000000-0000-4000-8000-000000000017', {
          description: 'Old bill',
          paidBy: actor('Lito Cruz', { formerStaff: true }),
          recordedBy: null,
        }),
        expenseItem('00000000-0000-4000-8000-000000000018', {
          description: 'Newer bill',
          paidBy: PAOLO,
          recordedBy: actor('Rhea Villanueva', { formerStaff: true }),
        }),
      ]),
    );
    renderPage();

    await screen.findByText('Old bill');
    const old = rowOf('Old bill');
    expect(cellOf(old, 'Paid by').textContent).toContain('Lito Cruz (former staff)');
    expect(cellOf(old, 'Recorded by').textContent).toBe('System');
    expect(within(cellOf(old, 'Recorded by')).queryByRole('img')).toBeNull();
    const newer = rowOf('Newer bill');
    expect(cellOf(newer, 'Paid by').textContent).toContain('Paolo Garcia');
    expect(cellOf(newer, 'Paid by').textContent).not.toContain('former staff');
    expect(cellOf(newer, 'Recorded by').textContent).toContain('Rhea Villanueva (former staff)');
  });

  it('draws Avatar 24 for a person, hidden from assistive technology (the name is the text)', async () => {
    expensesBackend(expenseList(ROWS.slice(0, 1)));
    renderPage();

    await screen.findByText('Shop rent for October');
    const cell = cellOf(rowOf('Shop rent for October'), 'Paid by');
    const avatar = cell.querySelector('[role="img"]');
    expect(avatar).not.toBeNull();
    expect(avatar?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('img', { name: 'Carmen Reyes' })).toBeNull();
  });
});

describe('the list states', () => {
  it('announces Loading expenses on the first load and shows a skeleton, then the rows', async () => {
    expensesBackend(async () => {
      await delay(150);
      return expenseList(ROWS);
    });
    renderPage();

    expect(await screen.findByText('Loading expenses…')).toBeInTheDocument();
    await screen.findByText('Shop rent for October');
    expect(screen.queryByText('Loading expenses…')).toBeNull();
  });

  it("shows Couldn't load expenses with Try Again, and Try Again reads the list again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    expensesBackend(() => {
      calls += 1;
      return calls === 1 ? problemResponse(500) : expenseList(ROWS);
    });
    const view = renderPage();

    expect(await screen.findByText("Couldn't load expenses.")).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByText('Shop rent for October');
    expect(screen.queryByText("Couldn't load expenses.")).toBeNull();
    expect(calls).toBe(2);
  });

  it('shows No expenses recorded with the window dates when the default window has no rows', async () => {
    expensesBackend(expenseList([]));
    const view = renderPage();

    expect(await screen.findByRole('heading', { name: 'No expenses recorded' })).toBeVisible();
    expect(
      screen.getByText(
        'Nothing is recorded from Sep 25, 2026 to Nov 24, 2026. Log rent, bills, payroll and supplies here to see monthly totals and where the money goes.',
      ),
    ).toBeVisible();
    // The header action and the first-use action (OQ-14, default A).
    expect(screen.getAllByRole('button', { name: 'Add Expense' })).toHaveLength(2);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/^Showing/)).toBeNull();
    await expectNoAxeViolations(view.container);
  });

  it('has no axe violations on the first load and with an Upcoming row by former staff', async () => {
    expensesBackend(async () => {
      await delay(100);
      return expenseList([
        expenseItem('00000000-0000-4000-8000-000000000021', {
          date: '2026-11-01',
          paidBy: actor('Lito Cruz', { formerStaff: true }),
          recordedBy: null,
        }),
      ]);
    });
    const view = renderPage();

    await screen.findByText('Loading expenses…');
    await expectNoAxeViolations(view.container);
    await screen.findByText('Upcoming');
    await expectNoAxeViolations(view.container);
  });
});

/** The URL writes nuqs made, as history mode and query string. */
function updates(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return spy.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('search (CEXP-01, WEB-10)', () => {
  it('shows Search "Description or staff name" capped at 100 in a search landmark', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();

    await screen.findByText('Shop rent for October');
    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(search).toHaveAttribute('placeholder', 'Description or staff name');
    expect(search).toHaveAttribute('maxlength', '100');
    expect(screen.getByRole('search')).toContainElement(search);
  });

  it('writes a typed search after 300 ms with a replace, asks the server once for the settled text and shows its chip', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('', onUrlUpdate);
    await screen.findByText('Shop rent for October');

    const search = screen.getByRole('searchbox', { name: 'Search' });
    for (const text of ['M', 'Me', 'Mer', 'Meralco']) {
      fireEvent.change(search, { target: { value: text } });
    }
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=Meralco' }]);
    });
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('q')).toBe('Meralco');
    });
    expect(calls.filter((url) => url.searchParams.has('q'))).toHaveLength(1);
    expect(await screen.findByText('Search: Meralco')).toBeInTheDocument();
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 2 expenses · newest first');
  });

  it('clearing the Search chip removes q from the URL and from the next request', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?q=Meralco', onUrlUpdate);
    await screen.findByText('Search: Meralco');

    await userEvent.click(screen.getByRole('button', { name: 'Clear search filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Search: Meralco')).toBeNull();
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.has('q')).toBe(false);
    });
  });

  it('shows no chip and sends no q when nothing is searched', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    renderPage();

    await screen.findByText('Shop rent for October');
    expect(screen.queryByRole('button', { name: /^Clear .* filter$/ })).toBeNull();
    expect(calls[0]?.searchParams.has('q')).toBe(false);
  });
});

const UTILITIES_ID = '51702a8f-81e4-4a20-8e39-2d4b270793de';
const UNKNOWN_ID = '11111111-2222-4333-8444-555555555555';

async function categorySelect(): Promise<HTMLElement> {
  const select = screen.getByRole('combobox', { name: 'Category' });
  await waitFor(() => {
    expect(select).toBeEnabled();
  });
  return select;
}

describe('category filter (D-11, D-15)', () => {
  it('lists every category in the server order, retired ones marked, and sends the chosen id', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('', onUrlUpdate);
    await screen.findByText('Shop rent for October');

    const select = await categorySelect();
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'All categories',
      ...EXPENSE_CATEGORIES.map((category) =>
        category.status === 'retired' ? `${category.name} (retired)` : category.name,
      ),
    ]);
    await userEvent.selectOptions(select, 'Utilities');

    expect(await screen.findByText('Category: Utilities')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('category')).toBe(UTILITIES_ID);
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?category=${UTILITIES_ID}` }]);
  });

  it('clearing the Category chip removes the category from the URL and the next request', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage(`?category=${UTILITIES_ID}`, onUrlUpdate);
    await screen.findByText('Category: Utilities');

    await userEvent.click(screen.getByRole('button', { name: 'Clear category filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Category: Utilities')).toBeNull();
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.has('category')).toBe(false);
    });
  });

  it('keeps a retired category selectable and names its chip by the plain name', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage(`?category=${RETIRED_CATEGORY_ID}`);

    expect(await screen.findByText('Category: Old subscriptions')).toBeInTheDocument();
    const select = await categorySelect();
    expect(select).toHaveValue(RETIRED_CATEGORY_ID);
  });

  it('falls back to All categories with one replace when the list does not hold the id in the URL', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage(`?category=${UNKNOWN_ID}`, onUrlUpdate);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    expect(screen.queryByText(/^Category:/)).toBeNull();
    expect(await categorySelect()).toHaveValue('');
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.has('category')).toBe(false);
    });
  });

  it('does not fall back while the categories are still loading', async () => {
    expensesBackend(expenseList(ROWS));
    categoriesBackend(async () => {
      await delay(150);
      return EXPENSE_CATEGORIES;
    });
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage(`?category=${UTILITIES_ID}`, onUrlUpdate);

    await screen.findByText('Shop rent for October');
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
    expect(screen.getByText('Category: Loading categories…')).toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();

    expect(await screen.findByText('Category: Utilities')).toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe('date range (D-23, OR-3)', () => {
  it('shows the response window in From and To when no range is set, and writes nothing to the URL', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('', onUrlUpdate);
    await screen.findByText('Shop rent for October');

    await waitFor(() => {
      expect(screen.getByLabelText('From')).toHaveValue('2026-09-25');
    });
    expect(screen.getByLabelText('To')).toHaveValue('2026-11-24');
    expect(screen.queryByText(/^Dates:/)).toBeNull();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(calls[0]?.searchParams.has('from')).toBe(false);
    expect(calls[0]?.searchParams.has('to')).toBe(false);
  });

  it('a shared link with a pair fills the inputs, sends the pair and shows the Dates chip', async () => {
    const { calls } = expensesBackend(expenseList(ROWS, { from: '2026-10-01', to: '2026-10-31' }));
    renderPage('?from=2026-10-01&to=2026-10-31');

    expect(await screen.findByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-31');
    await screen.findByText('Shop rent for October');
    expect(calls.at(-1)?.searchParams.get('from')).toBe('2026-10-01');
    expect(calls.at(-1)?.searchParams.get('to')).toBe('2026-10-31');
  });

  it('typing a valid pair writes both dates with a replace, asks the server and shows the Dates chip', async () => {
    const { calls } = expensesBackend((url) =>
      expenseList(ROWS, {
        from: url.searchParams.get('from') ?? '2026-09-25',
        to: url.searchParams.get('to') ?? '2026-11-24',
      }),
    );
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('', onUrlUpdate);
    await screen.findByText('Shop rent for October');
    await waitFor(() => {
      expect(screen.getByLabelText('To')).toHaveValue('2026-11-24');
    });

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } });

    expect(await screen.findByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '?from=2026-10-01&to=2026-10-31' });
    });
    expect(updates(onUrlUpdate).every((update) => update.history === 'replace')).toBe(true);
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('from')).toBe('2026-10-01');
    });
    expect(calls.at(-1)?.searchParams.get('to')).toBe('2026-10-31');
  });

  it('does not apply a half-filled range: no request, no URL write, no chip, and the error stays under the empty date', async () => {
    const { calls } = expensesBackend(expenseList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('', onUrlUpdate);
    await screen.findByText('Shop rent for October');
    await waitFor(() => {
      expect(screen.getByLabelText('To')).toHaveValue('2026-11-24');
    });
    const before = calls.length;

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });

    expect(await screen.findByText('Enter a real date.')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Dates:/)).toBeNull();
  });

  it('says the start date must be on or before the end date and keeps the last applied range', async () => {
    const { calls } = expensesBackend(expenseList(ROWS, { from: '2026-10-01', to: '2026-10-31' }));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?from=2026-10-01&to=2026-10-31', onUrlUpdate);
    await screen.findByText('Shop rent for October');
    const before = calls.length;

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-05' } });

    expect(await screen.findByText('The start date must be on or before the end date.')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
  });

  it('clearing the Dates chip returns to the default window', async () => {
    const { calls } = expensesBackend((url) =>
      url.searchParams.has('from') ? expenseList(ROWS, { from: '2026-10-01', to: '2026-10-31' }) : expenseList(ROWS),
    );
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?from=2026-10-01&to=2026-10-31', onUrlUpdate);
    await screen.findByText('Dates: Oct 1, 2026 to Oct 31, 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Clear dates filter' }));

    await waitFor(() => {
      expect(screen.queryByText(/^Dates:/)).toBeNull();
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.has('from')).toBe(false);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('From')).toHaveValue('2026-09-25');
    });
    expect(screen.getByLabelText('To')).toHaveValue('2026-11-24');
  });

  it('never reads the device clock for the window: a response far from the real date is shown as sent', async () => {
    expensesBackend(expenseList(ROWS, { from: '2031-01-01', to: '2031-03-01', today: '2031-02-01' }));
    renderPage();
    await screen.findByText('Shop rent for October');

    await waitFor(() => {
      expect(screen.getByLabelText('From')).toHaveValue('2031-01-01');
    });
    expect(screen.getByLabelText('To')).toHaveValue('2031-03-01');
  });
});

describe('no matches and Clear Filters (P2, P5 05-20 rule)', () => {
  const FILTERED = `?size=50&q=zzz&category=${UTILITIES_ID}&from=2026-10-01&to=2026-10-31`;

  function emptyWhenFiltered() {
    return expensesBackend((url) =>
      url.searchParams.has('q')
        ? expenseList([], { from: '2026-10-01', to: '2026-10-31' })
        : expenseList(ROWS, { total: 120, pageSize: 50 }),
    );
  }

  it('shows "No matches" naming the search and the filters, not the first-use empty state', async () => {
    emptyWhenFiltered();
    renderPage(FILTERED);

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'No expenses match “zzz” with category Utilities and dates Oct 1, 2026 to Oct 31, 2026. Try another search or clear the filters.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No expenses recorded' })).toBeNull();
    expect(screen.getByText('Search: zzz')).toBeInTheDocument();
    expect(screen.getByText('Category: Utilities')).toBeInTheDocument();
    expect(screen.getByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
  });

  it('shows "No matches" for a category or a date range alone as well', async () => {
    expensesBackend(expenseList([], { from: '2026-10-01', to: '2026-10-31' }));
    renderPage('?from=2026-10-01&to=2026-10-31');

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(
      screen.getByText('No expenses with dates Oct 1, 2026 to Oct 31, 2026. Try another search or clear the filters.'),
    ).toBeInTheDocument();
  });

  it('Clear Filters clears Search, Category and Dates in one replace and keeps Rows per page', async () => {
    const { calls } = emptyWhenFiltered();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage(FILTERED, onUrlUpdate);
    await screen.findByRole('heading', { name: 'No matches' });

    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(await screen.findByText('Shop rent for October')).toBeInTheDocument();
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '?size=50' });
    expect(screen.queryByText(/^(Search|Category|Dates):/)).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('50');
    const last = calls.at(-1);
    expect(Object.fromEntries(last?.searchParams ?? [])).toEqual({ page: '1', pageSize: '50' });
    expect(screen.getByLabelText('From')).toHaveValue('2026-09-25');
    expect(screen.getByLabelText('To')).toHaveValue('2026-11-24');
  });

  it('keeps the rows and dims them by colour after 200 ms while a filter loads', async () => {
    expensesBackend(async (url) => {
      if (url.searchParams.has('category')) {
        await delay(600);
      }
      return expenseList(ROWS);
    });
    renderPage();
    await screen.findByText('Shop rent for October');
    const region = screen.getByRole('region', { name: 'Company expenses' });
    expect(region).not.toHaveAttribute('data-refetching');

    await userEvent.selectOptions(await categorySelect(), 'Utilities');

    expect(screen.getByText('Shop rent for October')).toBeInTheDocument();
    expect(region).not.toHaveAttribute('data-refetching');
    await waitFor(() => {
      expect(region).toHaveAttribute('data-refetching', 'true');
    });
    expect(screen.getByText('Shop rent for October')).toBeInTheDocument();
    await waitFor(() => {
      expect(region).not.toHaveAttribute('data-refetching');
    });
  });

  it('has no axe violations with the toolbar, three chips and rows, and in the no-matches state', async () => {
    expensesBackend((url) =>
      url.searchParams.has('q') ? expenseList([], { from: '2026-10-01', to: '2026-10-31' }) : expenseList(ROWS),
    );
    const view = renderPage(`?category=${UTILITIES_ID}&from=2026-10-01&to=2026-10-31&q=rent`);

    await screen.findByRole('heading', { name: 'No matches' });
    await expectNoAxeViolations(view.container);

    await userEvent.click(screen.getByRole('button', { name: 'Clear search filter' }));
    await screen.findByText('Shop rent for October');
    expect(screen.getByText('Category: Utilities')).toBeInTheDocument();
    expect(screen.getByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
    await expectNoAxeViolations(view.container);
  });
});

/** The KPI card that holds a label, found by its overline text (head, then card). */
function kpiCard(label: string): HTMLElement {
  const card = screen.getByText(label).parentElement?.parentElement;
  if (card === null || card === undefined) {
    throw new Error(`No KPI card for ${label}`);
  }
  return card;
}

describe('month KPIs (CEXP-03, D-24)', () => {
  const NOVEMBER = expenseKpis({
    today: '2026-11-14',
    thisMonth: { month: '2026-11-01', total: 700, count: 2 },
    lastMonth: { month: '2026-10-01', total: 300, count: 1 },
    topCategory: { category: SUPPLIES, total: 500, sharePercent: 71 },
  });

  it("shows this month, last month and the top category as the server sends them, labelled with the server's months", async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(NOVEMBER);
    renderPage();

    await screen.findByText('This month · Nov');
    expect(kpiCard('This month · Nov').textContent).toContain('₱700.00');
    expect(kpiCard('This month · Nov').textContent).toContain('2 entries so far');
    expect(kpiCard('Last month · Oct').textContent).toContain('₱300.00');
    expect(kpiCard('Last month · Oct').textContent).toContain('Full month');
    const top = kpiCard('Top category · Nov');
    expect(top.textContent).toContain('Supplies');
    expect(top.textContent).toContain('₱500.00 · 71% of this month');
  });

  it('puts the KPI row above the toolbar and reads the KPIs once, with no parameters', async () => {
    expensesBackend(expenseList(ROWS));
    const { calls } = kpisBackend(NOVEMBER);
    renderPage();

    await screen.findByText('This month · Nov');
    const search = screen.getByRole('search');
    expect(kpiCard('This month · Nov').compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.search).toBe('');
  });

  it('says "1 entry so far" for one entry', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(expenseKpis({ thisMonth: { month: '2026-10-01', total: 90, count: 1 } }));
    renderPage();

    await screen.findByText('This month · Oct');
    expect(kpiCard('This month · Oct').textContent).toContain('1 entry so far');
  });

  it('says "No entries yet" for none', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(expenseKpis({ thisMonth: { month: '2026-10-01', total: 0, count: 0 }, topCategory: null }));
    renderPage();

    await screen.findByText('This month · Oct');
    expect(kpiCard('This month · Oct').textContent).toContain('No entries yet');
  });

  it('shows the figures the server sent and never adds, counts or rounds them itself', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(
      expenseKpis({
        thisMonth: { month: '2026-10-01', total: '1234.5', count: 7 },
        topCategory: { category: SUPPLIES, total: '99.99', sharePercent: 13 },
      }),
    );
    renderPage();

    await screen.findByText('This month · Oct');
    expect(kpiCard('This month · Oct').textContent).toContain('₱1,234.50');
    expect(kpiCard('This month · Oct').textContent).toContain('7 entries so far');
    expect(kpiCard('Top category · Oct').textContent).toContain('₱99.99 · 13% of this month');
  });

  it('does not read the KPIs again when a list filter changes', async () => {
    const user = userEvent.setup();
    const { calls: listCalls } = expensesBackend(expenseList(ROWS));
    const { calls } = kpisBackend(NOVEMBER);
    renderPage();
    await screen.findByText('This month · Nov');
    await screen.findByText('Shop rent for October');

    await user.selectOptions(await categorySelect(), 'Utilities');
    await waitFor(() => {
      expect(listCalls.some((url) => url.searchParams.has('category'))).toBe(true);
    });
    await screen.findByText('Shop rent for October');

    expect(calls).toHaveLength(1);
  });

  it('has no axe violations with the KPI row and the rows', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(NOVEMBER);
    const view = renderPage();

    await screen.findByText('This month · Nov');
    await screen.findByText('Shop rent for October');
    await expectNoAxeViolations(view.container);
  });
});

describe('month KPI states (OR-4, D-39, loading and error)', () => {
  it('shows an empty Top category with "No expenses this month" when the month has no expenses', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(expenseKpis({ thisMonth: { month: '2026-10-01', total: 0, count: 0 }, topCategory: null }));
    const view = renderPage();

    await screen.findByText('Top category · Oct');
    const top = kpiCard('Top category · Oct');
    expect(top.textContent).toContain('Not set');
    expect(top.textContent).toContain('No expenses this month');
    expect(top.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(top).getByText('Not set')).toBeInTheDocument();
    await expectNoAxeViolations(view.container);
  });

  it('dims a ₱0.00 month total by colour', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(expenseKpis({ thisMonth: { month: '2026-10-01', total: 0, count: 0 }, topCategory: null }));
    renderPage();

    await screen.findByText('This month · Oct');
    const value = kpiCard('This month · Oct').children[1];
    expect(value?.textContent).toBe('₱0.00');
    expect(value?.classList.contains('text-ink-subtle')).toBe(true);
    expect(kpiCard('Last month · Sep').children[1]?.classList.contains('text-ink-subtle')).toBe(false);
  });

  it('shows each card as a busy skeleton while the KPIs load, and the list loads on its own', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(async () => {
      await delay(300);
      return expenseKpis();
    });
    renderPage();

    for (const label of ['This month', 'Last month', 'Top category']) {
      const card = kpiCard(label);
      expect(card).toHaveAttribute('aria-busy', 'true');
      expect(card.querySelector('[style*="--sk-h"]')).not.toBeNull();
    }
    await screen.findByText('Shop rent for October');
    expect(kpiCard('This month')).toHaveAttribute('aria-busy', 'true');

    await screen.findByText('This month · Oct');
    expect(kpiCard('This month · Oct')).not.toHaveAttribute('aria-busy');
  });

  it('replaces the row with "Couldn\'t load this month\'s totals." on a failure, while the list still renders', async () => {
    expensesBackend(expenseList(ROWS));
    kpisBackend(() => problemResponse(500));
    const view = renderPage();

    expect(await screen.findByText("Couldn't load this month's totals.")).toBeVisible();
    expect(screen.getByText('Check your internet connection. Your data is safe. Nothing was changed.')).toBeVisible();
    expect(screen.queryByText(/^This month/)).toBeNull();
    expect(await screen.findByText('Shop rent for October')).toBeVisible();
    expect(screen.queryByText("Couldn't load expenses.")).toBeNull();
    await expectNoAxeViolations(view.container);
  });

  it('Try Again reads only the KPIs again', async () => {
    const user = userEvent.setup();
    const { calls: listCalls } = expensesBackend(expenseList(ROWS));
    let kpiCalls = 0;
    kpisBackend(() => {
      kpiCalls += 1;
      return kpiCalls === 1 ? problemResponse(500) : expenseKpis();
    });
    renderPage();
    await screen.findByText("Couldn't load this month's totals.");
    await screen.findByText('Shop rent for October');
    expect(listCalls).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByText('This month · Oct');
    expect(screen.queryByText("Couldn't load this month's totals.")).toBeNull();
    expect(kpiCalls).toBe(2);
    expect(listCalls).toHaveLength(1);
  });
});

describe('Add Expense (CEXP-02; plan 06-12)', () => {
  it('shows the primary Add Expense button with the plus icon in the header', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    const button = screen.getByRole('button', { name: 'Add Expense' });
    expect(button.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the Add Expense dialog with today from the list response', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS, { today: '2026-11-14' }));
    staffBackend();
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: 'Add Expense' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add Expense' });
    expect(within(dialog).getByLabelText(/^Date/)).toHaveValue('2026-11-14');
  });

  it('after a save closes the dialog, returns focus to Add Expense, reads the lists and KPIs again and shows the toast', async () => {
    const user = userEvent.setup();
    const { calls } = expensesBackend(expenseList(ROWS));
    const { calls: kpiCalls } = kpisBackend();
    staffBackend();
    createExpenseBackend();
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    renderPage();
    await screen.findByText('Shop rent for October');
    const listReads = calls.length;
    const kpiReads = kpiCalls.length;

    const opener = screen.getByRole('button', { name: 'Add Expense' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Add Expense' });
    await waitFor(() => {
      expect(within(dialog).getByRole('combobox', { name: /^Paid by/ })).toBeEnabled();
      expect(within(dialog).getByRole('combobox', { name: /^Category/ })).toBeEnabled();
    });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Category/ }), 'Supplies');
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Thread and needles');
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '640');
    await user.click(within(dialog).getByRole('button', { name: 'Save Expense' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Expense' })).toBeNull();
    });
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
    expect(await screen.findByText('Expense added')).toBeVisible();
    expect(screen.getByText(/^₱640\.00 · Supplies/)).toBeVisible();
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(listReads);
      expect(kpiCalls.length).toBeGreaterThan(kpiReads);
    });
    expect(invalidated).toEqual(expect.arrayContaining([expensesKey, expenseKpisKey, expensesDeletedKey]));
  });
});

describe('Add Expense from the empty list and the outside-filters note (CEXP-02, OQ-14; plan 06-12)', () => {
  /** Fills the open dialog and saves; the fake API answers with `saved`. */
  async function saveFromDialog(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await screen.findByRole('dialog', { name: 'Add Expense' });
    await waitFor(() => {
      expect(within(dialog).getByRole('combobox', { name: /^Paid by/ })).toBeEnabled();
      expect(within(dialog).getByRole('combobox', { name: /^Category/ })).toBeEnabled();
    });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Category/ }), 'Supplies');
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Thread and needles');
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '640');
    await user.click(within(dialog).getByRole('button', { name: 'Save Expense' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Expense' })).toBeNull();
    });
  }

  const SAVED_NOTE = "₱640.00 · Supplies It's outside the current filters, so it isn't listed.";

  async function openAndSave(search: string, saved = expenseDetail()) {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    staffBackend();
    createExpenseBackend(() => Response.json(saved, { status: 201 }));
    renderPage(search);
    await screen.findByText('Shop rent for October');
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    await saveFromDialog(user);
  }

  it('shows the primary Add Expense action in the first-use empty state too, and it opens the same dialog', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList([]));
    staffBackend();
    renderPage();
    await screen.findByRole('heading', { name: 'No expenses recorded' });

    const buttons = screen.getAllByRole('button', { name: 'Add Expense' });
    expect(buttons).toHaveLength(2);
    const emptyAction = buttons.at(-1);
    if (emptyAction === undefined) {
      throw new Error('No Add Expense button.');
    }
    await user.click(emptyAction);

    expect(await screen.findByRole('dialog', { name: 'Add Expense' })).toBeVisible();
  });

  it('does not add the note when no filter is set and the expense is inside the default window', async () => {
    await openAndSave('');

    expect(await screen.findByText('₱640.00 · Supplies')).toBeVisible();
    expect(screen.queryByText(/outside the current filters/)).toBeNull();
  });

  it('adds the note when a search does not match the saved description or people', async () => {
    await openAndSave('?q=rent');

    expect(await screen.findByText(SAVED_NOTE)).toBeVisible();
  });

  it('does not add the note when the search matches the description, the payer or the recorder, in any letter case', async () => {
    await openAndSave('?q=NEEDLES');
    expect(await screen.findByText('₱640.00 · Supplies')).toBeVisible();
  });

  it('does not add the note when the search matches the payer name', async () => {
    await openAndSave('?q=carmen');
    expect(await screen.findByText('₱640.00 · Supplies')).toBeVisible();
  });

  it('adds the note when the category filter is another category, and not when it is the same one', async () => {
    await openAndSave(`?category=${RENT.id}`);
    expect(await screen.findByText(SAVED_NOTE)).toBeVisible();
  });

  it('does not add the note when the category filter is the saved category', async () => {
    await openAndSave(`?category=${SUPPLIES.id}`);
    expect(await screen.findByText('₱640.00 · Supplies')).toBeVisible();
  });

  it('adds the note when the dates in the URL do not hold the saved date', async () => {
    await openAndSave('?from=2026-10-01&to=2026-10-20');
    expect(await screen.findByText(SAVED_NOTE)).toBeVisible();
  });

  it('adds the note when the saved date is outside the default window the server used', async () => {
    await openAndSave('', expenseDetail({ date: '2026-12-31' }));
    expect(await screen.findByText(SAVED_NOTE)).toBeVisible();
  });
});

describe('Edit Expense (CEXP-02, D-26; plan 06-14)', () => {
  const SECOND_ID = '00000000-0000-4000-8000-000000000002';

  it('gives a Manager an Edit button on every row, named with the description and date and with a matching title', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    const rent = screen.getByRole('button', { name: 'Edit Shop rent for October, Oct 6, 2026' });
    const thread = screen.getByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' });
    expect(rent).toHaveAttribute('title', 'Edit Shop rent for October, Oct 6, 2026');
    expect(thread).toHaveAttribute('title', 'Edit Thread and needles, Oct 5, 2026');
    expect(screen.queryByRole('button', { name: /^View / })).toBeNull();
  });

  it('opens the Edit Expense dialog for that row and reads that expense', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    staffBackend();
    const { ids } = expenseDetailBackend(expenseDetail({ id: SECOND_ID, description: 'Thread and needles' }));
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Expense' });
    expect(await within(dialog).findByRole('textbox', { name: /^Description/ })).toHaveValue('Thread and needles');
    expect(ids).toEqual([SECOND_ID]);
  });

  it("after a save closes the dialog, returns focus to that row's Edit button, reads the lists and KPIs again and shows the toast", async () => {
    const user = userEvent.setup();
    const { calls } = expensesBackend(expenseList(ROWS));
    const { calls: kpiCalls } = kpisBackend();
    staffBackend();
    expenseDetailBackend(expenseDetail({ id: SECOND_ID }));
    const sent = updateExpenseBackend(() =>
      Response.json(expenseDetail({ id: SECOND_ID, amount: 700, category: SUPPLIES })),
    );
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    renderPage();
    await screen.findByText('Shop rent for October');
    const listReads = calls.length;
    const kpiReads = kpiCalls.length;

    const opener = screen.getByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Edit Expense' });
    const amount = await within(dialog).findByRole('textbox', { name: /^Amount/ });
    await waitFor(() => {
      expect(within(dialog).getByRole('combobox', { name: /^Paid by/ })).toBeEnabled();
    });
    await user.clear(amount);
    await user.type(amount, '700');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Expense' })).toBeNull();
    });
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
    expect(sent.ids).toEqual([SECOND_ID]);
    expect(await screen.findByText('Expense updated')).toBeVisible();
    expect(screen.getByText('₱700.00 · Supplies')).toBeVisible();
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(listReads);
      expect(kpiCalls.length).toBeGreaterThan(kpiReads);
    });
    expect(invalidated).toEqual(expect.arrayContaining([expensesKey, expenseKpisKey, expensesDeletedKey]));
  });

  it('moves focus to the table caption when the saved row is no longer on the page', async () => {
    const user = userEvent.setup();
    let phase: 'before' | 'after' = 'before';
    expensesBackend(() => expenseList(phase === 'before' ? ROWS : [ROWS[0] ?? expenseItem('x')]));
    staffBackend();
    expenseDetailBackend(expenseDetail({ id: SECOND_ID }));
    updateExpenseBackend(() => {
      phase = 'after';
      return Response.json(expenseDetail({ id: SECOND_ID, amount: 700 }));
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Expense' });
    await within(dialog).findByRole('textbox', { name: /^Amount/ });
    await waitFor(() => {
      expect(within(dialog).getByRole('combobox', { name: /^Paid by/ })).toBeEnabled();
    });
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.queryByText('Thread and needles')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText('Company expenses', { selector: 'caption' })).toHaveFocus();
    });
  });
});

describe('View Expense for an Admin (OQ-8, D-26; plan 06-14)', () => {
  const FIRST_ID = '00000000-0000-4000-8000-000000000001';
  const SECOND_ID = '00000000-0000-4000-8000-000000000002';
  // Carmen (the Admin) may edit the first row; the second is Paolo's, so the server says canEdit false.
  const ADMIN_ROWS = [
    expenseItem(FIRST_ID, { description: 'Shop rent for October', date: '2026-10-06', canEdit: true }),
    expenseItem(SECOND_ID, {
      description: 'Thread and needles',
      date: '2026-10-05',
      amount: 640.5,
      category: SUPPLIES,
      paidBy: PAOLO,
      recordedBy: PAOLO,
      canEdit: false,
    }),
  ];

  beforeEach(() => {
    clearSession();
    acceptSession(
      sessionResponse({
        user: {
          id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
          email: 'carmen@example.ph',
          firstName: 'Carmen',
          lastName: 'Reyes',
          role: 'Admin',
        },
      }),
    );
  });

  it('gives an Admin Edit on the rows the server says they may edit and View on the others, never a delete', async () => {
    expensesBackend(expenseList(ADMIN_ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    expect(screen.getByRole('button', { name: 'Edit Shop rent for October, Oct 6, 2026' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'View Shop rent for October, Oct 6, 2026' })).toBeNull();
    const view = screen.getByRole('button', { name: 'View Thread and needles, Oct 5, 2026' });
    expect(view).toHaveAttribute('title', 'View Thread and needles, Oct 5, 2026');
    expect(view.querySelector('svg')).toHaveClass('lucide-eye');
    expect(screen.queryByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });

  it('opens Expense details for a View with the notes, and Close returns focus to that View button', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ADMIN_ROWS));
    const { ids } = expenseDetailBackend(
      expenseDetail({ id: SECOND_ID, notes: 'Bought in bulk', paidBy: PAOLO, recordedBy: PAOLO, canEdit: false }),
    );
    renderPage();
    await screen.findByText('Shop rent for October');

    const opener = screen.getByRole('button', { name: 'View Thread and needles, Oct 5, 2026' });
    await user.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Expense details' });
    expect(await within(dialog).findByText('Bought in bulk')).toBeVisible();
    expect(ids).toEqual([SECOND_ID]);
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1) ?? dialog);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Expense details' })).toBeNull();
    });
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });

  it('shows an Admin no Deleted Expenses link and no delete action of either kind', async () => {
    expensesBackend(expenseList(ADMIN_ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    expect(screen.queryByRole('link', { name: 'Deleted Expenses' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(screen.queryByRole('button', { name: /permanently$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Expense' })).toBeVisible();
  });

  it('has no axe violations with Edit and View buttons in the rows', async () => {
    expensesBackend(expenseList(ADMIN_ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    await expectNoAxeViolations(document.body);
  });
});

describe('Delete Expense (D-01, D-02, D-05; plan 06-16)', () => {
  const FIRST_ID = '00000000-0000-4000-8000-000000000001';
  const SECOND_ID = '00000000-0000-4000-8000-000000000002';
  const RENT_DELETE = 'Delete Shop rent for October, Oct 6, 2026';
  const THREAD_DELETE = 'Delete Thread and needles, Oct 5, 2026';
  const RENT_PURGE = 'Delete Shop rent for October, Oct 6, 2026 permanently';
  const RENT_TITLE = 'Delete “Shop rent for October” (₱12,450.00)?';

  /** The list drops the deleted rows once the DELETE has been answered. */
  function listThatLoses(gone: Set<string>) {
    return () => expenseList(ROWS.filter((row) => !gone.has(row.id)));
  }

  it('gives a Manager Edit, then Delete, then Delete permanently on every row, named with the description and date and with a matching title', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    const rent = rowOf('Shop rent for October');
    const names = within(rent)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(names).toEqual(['Edit Shop rent for October, Oct 6, 2026', RENT_DELETE, RENT_PURGE]);
    expect(screen.getByRole('button', { name: RENT_PURGE })).toHaveAttribute('title', RENT_PURGE);
    expect(screen.getByRole('button', { name: RENT_PURGE }).querySelector('svg')).toHaveClass('lucide-eraser');
    expect(screen.getByRole('button', { name: RENT_DELETE })).toHaveAttribute('title', RENT_DELETE);
    expect(screen.getByRole('button', { name: THREAD_DELETE })).toHaveAttribute('title', THREAD_DELETE);
  });

  it('opens the confirmation with the quoted title, the message and Cancel focused, and sends nothing yet', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    const sent = deleteExpenseBackend();
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));

    const dialog = await screen.findByRole('dialog', { name: RENT_TITLE });
    expect(
      within(dialog).getByText(
        "It won't count in the expense list, totals or the payer's balance. You can restore it later from Deleted Expenses.",
      ),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete Expense' })).toBeVisible();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(sent.ids).toEqual([]);
  });

  it('Cancel closes the confirmation, sends nothing and returns focus to that Delete button', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    const sent = deleteExpenseBackend();
    renderPage();
    await screen.findByText('Shop rent for October');
    const opener = screen.getByRole('button', { name: RENT_DELETE });

    await user.click(opener);
    await user.click(
      within(await screen.findByRole('dialog', { name: RENT_TITLE })).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(opener).toHaveFocus();
    expect(sent.ids).toEqual([]);
  });

  it('puts a very long description in the dialog title, which wraps anywhere', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList([expenseItem(FIRST_ID, { description: LONG_DESCRIPTION })]));
    renderPage();
    await screen.findByText(LONG_DESCRIPTION);

    await user.click(screen.getByRole('button', { name: `Delete ${LONG_DESCRIPTION}, Oct 6, 2026` }));

    const dialog = await screen.findByRole('dialog');
    const title = within(dialog).getByRole('heading', { name: `Delete “${LONG_DESCRIPTION}” (₱12,450.00)?` });
    expect(title.parentElement).toHaveClass('wrap-anywhere');
  });

  it('confirming sends DELETE, drops the row, moves focus to the next row first action, reads the lists and KPIs again and toasts', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const { calls } = expensesBackend(listThatLoses(gone));
    const { calls: kpiCalls } = kpisBackend();
    const sent = deleteExpenseBackend(() => {
      gone.add(FIRST_ID);
      return new Response(null, { status: 204 });
    });
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    renderPage();
    await screen.findByText('Shop rent for October');
    const listReads = calls.length;
    const kpiReads = kpiCalls.length;

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));
    await user.click(
      within(await screen.findByRole('dialog', { name: RENT_TITLE })).getByRole('button', { name: 'Delete Expense' }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Shop rent for October')).toBeNull();
    });
    expect(sent.ids).toEqual([FIRST_ID]);
    expect(sent.keys).toEqual([null]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' })).toHaveFocus();
    });
    expect(await screen.findByText('Expense deleted')).toBeVisible();
    expect(screen.getByText('Shop rent for October. You can restore it from Deleted Expenses.')).toBeVisible();
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(listReads);
      expect(kpiCalls.length).toBeGreaterThan(kpiReads);
    });
    expect(invalidated).toEqual(expect.arrayContaining([expensesKey, expenseKpisKey, expensesDeletedKey]));
  });

  it('moves focus to the previous row first action when the deleted row was the last one', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    expensesBackend(listThatLoses(gone));
    deleteExpenseBackend(() => {
      gone.add(SECOND_ID);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Thread and needles');

    await user.click(screen.getByRole('button', { name: THREAD_DELETE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Expense' }));

    await waitFor(() => {
      expect(screen.queryByText('Thread and needles')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Shop rent for October, Oct 6, 2026' })).toHaveFocus();
    });
  });

  it('moves focus to the heading when the list empties', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    expensesBackend(() => expenseList(ROWS.slice(0, 1).filter((row) => !gone.has(row.id))));
    deleteExpenseBackend(() => {
      gone.add(FIRST_ID);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Expense' }));

    await waitFor(() => {
      expect(screen.queryByText('Shop rent for October')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Company Expenses' })).toHaveFocus();
    });
  });

  it('shows the confirm button as Deleting while the request runs', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    deleteExpenseBackend(async () => {
      await delay(150);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Expense' }));

    expect(await screen.findByRole('button', { name: 'Deleting' })).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('keeps the dialog open on a server failure, with the mapper line as an alert and focus on the confirm button', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    deleteExpenseBackend(() => problemResponse(500));
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));
    const dialog = await screen.findByRole('dialog', { name: RENT_TITLE });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Expense' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/Something went wrong/);
    expect(within(dialog).getByRole('button', { name: 'Delete Expense' })).toHaveFocus();
    expect(screen.getByText('Shop rent for October')).toBeVisible();
  });

  it('closes the dialog on a 404, reads the list again and says the expense was already deleted', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const { calls } = expensesBackend(listThatLoses(gone));
    deleteExpenseBackend(() => {
      gone.add(FIRST_ID);
      return problemResponse(404);
    });
    renderPage();
    await screen.findByText('Shop rent for October');
    const reads = calls.length;

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Expense' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByText('Already deleted')).toBeVisible();
    expect(screen.getByText('Someone else deleted this expense. The list is up to date.')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByText('Shop rent for October')).toBeNull();
    });
    expect(calls.length).toBeGreaterThan(reads);
  });

  it('has no axe violations with the delete actions in the rows and with the confirmation open', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: RENT_DELETE }));
    await screen.findByRole('dialog', { name: RENT_TITLE });
    await expectNoAxeViolations(document.body);
  });
});

describe('the Deleted Expenses link (D-03, D-07, OQ-2; plan 06-16)', () => {
  it('gives a Manager a Deleted Expenses link to the deleted page, before Add Expense', async () => {
    expensesBackend(expenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    const link = screen.getByRole('link', { name: 'Deleted Expenses' });
    expect(link).toHaveAttribute('href', '/admin/expenses/deleted');
    const add = screen.getByRole('button', { name: 'Add Expense' });
    expect(link.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.parentElement).toBe(add.parentElement);
  });
});

describe('Delete permanently from the list (D-04, D-05, OQ-1; plan 06-16)', () => {
  const FIRST_ID = '00000000-0000-4000-8000-000000000001';
  const RENT_PURGE = 'Delete Shop rent for October, Oct 6, 2026 permanently';
  const THREAD_PURGE = 'Delete Thread and needles, Oct 5, 2026 permanently';
  const PURGE_TITLE = 'Delete “Shop rent for October” (₱12,450.00) permanently?';
  const PURGE_MESSAGE =
    "This removes the expense for good. It can't be restored, and this can't be undone. The audit log keeps its date, category, amount and payer.";

  function listThatLoses(gone: Set<string>) {
    return () => expenseList(ROWS.filter((row) => !gone.has(row.id)));
  }

  it('opens the permanent confirmation with its title and message, Cancel focused, and sends nothing yet', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    const sent = purgeExpenseBackend();
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_PURGE }));

    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    expect(within(dialog).getByText(PURGE_MESSAGE)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete Permanently' })).toBeVisible();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(sent.ids).toEqual([]);
  });

  it('confirming sends the permanent DELETE, drops the row, moves focus to the next row first action, reads the lists again and toasts', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const { calls } = expensesBackend(listThatLoses(gone));
    const sent = purgeExpenseBackend(() => {
      gone.add(FIRST_ID);
      return new Response(null, { status: 204 });
    });
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    renderPage();
    await screen.findByText('Shop rent for October');
    const reads = calls.length;

    await user.click(screen.getByRole('button', { name: RENT_PURGE }));
    await user.click(
      within(await screen.findByRole('dialog', { name: PURGE_TITLE })).getByRole('button', {
        name: 'Delete Permanently',
      }),
    );

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('Shop rent for October')).toBeNull();
    });
    expect(sent.ids).toEqual([FIRST_ID]);
    expect(sent.keys).toEqual([null]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Thread and needles, Oct 5, 2026' })).toHaveFocus();
    });
    expect(await screen.findByText('Expense permanently deleted')).toBeVisible();
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(reads);
    });
    expect(invalidated).toEqual(expect.arrayContaining([expensesKey, expenseKpisKey, expensesDeletedKey]));
  });

  it('shows the description alone in the toast message', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    expensesBackend(listThatLoses(gone));
    purgeExpenseBackend(() => {
      gone.add(FIRST_ID);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_PURGE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Permanently' }));

    const title = await screen.findByText('Expense permanently deleted');
    expect(title.parentElement?.textContent).toBe('Expense permanently deletedShop rent for October');
  });

  it('moves focus to the previous row first action when the last row was deleted for good', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    expensesBackend(listThatLoses(gone));
    purgeExpenseBackend((id) => {
      gone.add(id);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Thread and needles');

    await user.click(screen.getByRole('button', { name: THREAD_PURGE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Permanently' }));

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('Thread and needles')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Shop rent for October, Oct 6, 2026' })).toHaveFocus();
    });
  });

  it('keeps the dialog open on a server failure, with the mapper line as an alert and focus on the confirm button', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    purgeExpenseBackend(() => problemResponse(500));
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_PURGE }));
    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Permanently' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Something went wrong/);
    expect(within(dialog).getByRole('button', { name: 'Delete Permanently' })).toHaveFocus();
    expect(screen.getByText('Shop rent for October')).toBeVisible();
  });

  it('closes the dialog on a 404 and says the expense was already deleted', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    expensesBackend(listThatLoses(gone));
    purgeExpenseBackend(() => {
      gone.add(FIRST_ID);
      return problemResponse(404);
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_PURGE }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Permanently' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByText('Already deleted')).toBeVisible();
    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('Shop rent for October')).toBeNull();
    });
  });

  it('has no axe violations with the permanent confirmation open', async () => {
    const user = userEvent.setup();
    expensesBackend(expenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RENT_PURGE }));
    await screen.findByRole('dialog', { name: PURGE_TITLE });
    await expectNoAxeViolations(document.body);
  });
});
