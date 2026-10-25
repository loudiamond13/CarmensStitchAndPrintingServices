import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
