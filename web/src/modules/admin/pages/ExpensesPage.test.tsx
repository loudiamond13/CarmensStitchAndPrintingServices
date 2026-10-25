import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { badgeToneClasses } from '@/components/status/status.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { ExpensesRoute } from '@/modules/admin/pages/ExpensesPage';
import {
  CARMEN,
  expenseItem,
  expenseList,
  expensesBackend,
  LONG_DESCRIPTION,
  LONG_NAME,
  PAOLO,
  problemResponse,
  SUPPLIES,
  actor,
} from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';

// E1 Company Expenses, /admin/expenses (CEXP-01, CEXP-04, CEXP-05, D-23, D-25; plan 06-04): the server's rows, paged, with
// the server's period total in the footer.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
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
          <ExpensesRoute />
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
  it('shows the header, the result bar, the table name and the six column headers', async () => {
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
    expect(headers).toEqual(['Date', 'Category', 'Description', 'Amount', 'Paid by', 'Recorded by']);
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
    // The Add Expense action arrives with plan 06-12.
    expect(screen.queryByRole('button', { name: 'Add Expense' })).toBeNull();
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
