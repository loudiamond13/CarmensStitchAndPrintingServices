import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { expensesDeletedKey } from '@/modules/admin/hooks/useDeletedExpensesQuery';
import { expenseCategoriesKey } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { expenseKpisKey } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { DeletedExpensesRoute } from '@/modules/admin/pages/DeletedExpensesPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  actor,
  CARMEN,
  deletedExpenseItem,
  deletedExpenseList,
  deletedExpensesBackend,
  PAOLO,
  problemResponse,
  purgeExpenseBackend,
  restoreExpenseBackend,
  SUPPLIES,
} from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';

// E4 Deleted Expenses, /admin/expenses/deleted (D-03, D-07, OQ-2, OQ-5; plan 06-16): a Manager finds a deleted expense and
// brings it back.

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
            <DeletedExpensesRoute />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(<Harness search={search} onUrlUpdate={onUrlUpdate} />);
}

const FIRST_ID = '00000000-0000-4000-8000-000000000001';
const SECOND_ID = '00000000-0000-4000-8000-000000000002';
const THIRD_ID = '00000000-0000-4000-8000-000000000003';

const ROWS = [
  deletedExpenseItem(FIRST_ID, {
    deletedAt: '2026-10-12T07:42:00Z',
    date: '2026-10-06',
    description: 'Shop rent for October',
    amount: 12450,
  }),
  deletedExpenseItem(SECOND_ID, {
    deletedAt: '2026-10-11T02:05:00Z',
    date: '2026-10-05',
    description: 'Thread and needles',
    amount: 640.5,
    category: SUPPLIES,
    paidBy: PAOLO,
    deletedBy: actor('Lito Cruz', { formerStaff: true }),
  }),
  deletedExpenseItem(THIRD_ID, { date: '2026-10-04', description: 'Meralco bill', amount: 3200, deletedBy: null }),
];

const RESTORE_FIRST = 'Restore Shop rent for October, Oct 6, 2026';
const RESTORE_SECOND = 'Restore Thread and needles, Oct 5, 2026';
const RESTORE_THIRD = 'Restore Meralco bill, Oct 4, 2026';

describe('the page', () => {
  it('shows the back link, the heading with the Manager only badge, the subline, the toolbar and the result bar', async () => {
    deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage();

    const back = screen.getByRole('link', { name: 'Back to Company Expenses' });
    expect(back).toHaveAttribute('href', '/admin/expenses');
    const heading = screen.getByRole('heading', { level: 1, name: 'Deleted Expenses' });
    expect(heading).toBeVisible();
    expect(within(heading.parentElement ?? document.body).getByText('Manager only')).toBeVisible();
    expect(
      screen.getByText(
        "Deleted expenses don't count in lists, totals or balances. Restore one to count it again, or delete it permanently.",
      ),
    ).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeVisible();
    expect(await screen.findByRole('combobox', { name: 'Category' })).toBeVisible();
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();
    await screen.findByText('Shop rent for October');
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 3 deleted expenses · most recently deleted first');
    expect(document.title).toBe('Deleted Expenses · CSPS Admin');
  });

  it('shows the Deleted expenses table with its eight columns and no total row', async () => {
    deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage();

    const table = await screen.findByRole('table', { name: 'Deleted expenses' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Deleted',
      'Date',
      'Category',
      'Description',
      'Amount',
      'Paid by',
      'Deleted by',
      'Actions',
    ]);
    expect(table.querySelector('tfoot')).toBeNull();
  });

  it('reads each row: the delete time in a time element in Manila time, the date, category, amount, payer and deleter', async () => {
    deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage();

    await screen.findByText('Shop rent for October');
    const rent = screen.getAllByRole('row').find((row) => within(row).queryByText('Shop rent for October') !== null);
    if (rent === undefined) throw new Error('No rent row');
    const deleted = rent.querySelector<HTMLElement>('td[data-label="Deleted"]');
    const time = deleted?.querySelector('time');
    expect(time?.textContent).toBe('Oct 12, 2026, 3:42 PM');
    expect(time).toHaveAttribute('datetime', '2026-10-12T07:42:00Z');
    expect(rent.querySelector('td[data-label="Date"]')?.textContent).toBe('Oct 6, 2026');
    expect(within(rent).getByText('Rent')).toBeVisible();
    expect(rent.querySelector('td[data-label="Amount"]')?.textContent).toBe('₱12,450.00');
    expect(rent.querySelector('td[data-label="Paid by"]')?.textContent).toContain('Carmen Reyes');
    expect(rent.querySelector('td[data-label="Deleted by"]')?.textContent).toContain('Carmen Reyes');

    const thread = screen.getAllByRole('row').find((row) => within(row).queryByText('Thread and needles') !== null);
    expect(thread?.querySelector('td[data-label="Deleted by"]')?.textContent).toContain('Lito Cruz');
    expect(thread?.querySelector('td[data-label="Deleted by"]')?.textContent).toContain('(former staff)');
  });

  it('names Restore with the description and date, with a matching title', async () => {
    deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    const restore = screen.getByRole('button', { name: RESTORE_FIRST });
    expect(restore).toHaveAttribute('title', RESTORE_FIRST);
    expect(restore.querySelector('svg')).toHaveClass('lucide-rotate-ccw');
  });

  it('says 1 deleted expense for one row', async () => {
    deletedExpensesBackend(deletedExpenseList(ROWS.slice(0, 1)));
    renderPage();

    await screen.findByText('Shop rent for October');
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 1 deleted expense · most recently deleted first');
  });

  it('sends the page, size, search and category from the URL, and never a date', async () => {
    const { calls } = deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage(`?q=rent&category=6869715c-a01f-4053-87d8-8fd39feebebc&page=2&size=10`);

    await screen.findByText('Shop rent for October');
    const params = Object.fromEntries(calls.at(-1)?.searchParams ?? []);
    expect(params).toEqual({
      q: 'rent',
      category: '6869715c-a01f-4053-87d8-8fd39feebebc',
      page: '2',
      pageSize: '10',
    });
  });

  it('shows a chip for the search and clears it', async () => {
    const user = userEvent.setup();
    const { calls } = deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage('?q=rent');

    await screen.findByText('Shop rent for October');
    expect(screen.getByText('Search: rent')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear search filter' }));

    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.has('q')).toBe(false);
    });
  });
});

describe('Restore (D-03, OQ-5)', () => {
  /** The list drops the restored rows once the POST has been answered. */
  function listThatLoses(gone: Set<string>) {
    return () => deletedExpenseList(ROWS.filter((row) => !gone.has(row.id)));
  }

  it('acts at once with no confirmation: sends the POST with an Idempotency-Key, drops the row, moves focus to the next Restore and toasts', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const { calls } = deletedExpensesBackend(listThatLoses(gone));
    const sent = restoreExpenseBackend(() => {
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

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByText('Shop rent for October')).toBeNull();
    });
    expect(sent.ids).toEqual([FIRST_ID]);
    expect(sent.keys[0]).toMatch(/\S/);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
    expect(await screen.findByText('Expense restored')).toBeVisible();
    expect(screen.getByText('Shop rent for October counts in totals again.')).toBeVisible();
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(reads);
    });
    expect(invalidated).toEqual(
      expect.arrayContaining([expensesKey, expenseKpisKey, expensesDeletedKey, expenseCategoriesKey]),
    );
  });

  it('moves focus to the previous Restore when the last row was restored', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedExpensesBackend(listThatLoses(gone));
    restoreExpenseBackend(() => {
      gone.add(THIRD_ID);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Meralco bill');

    await user.click(screen.getByRole('button', { name: RESTORE_THIRD }));

    await waitFor(() => {
      expect(screen.queryByText('Meralco bill')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
  });

  it('moves focus to the heading when the list empties', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedExpensesBackend(() => deletedExpenseList(ROWS.slice(0, 1).filter((row) => !gone.has(row.id))));
    restoreExpenseBackend(() => {
      gone.add(FIRST_ID);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(await screen.findByText('No deleted expenses')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Deleted Expenses' })).toHaveFocus();
    });
  });

  it('shows a persistent danger toast with the mapper line when Restore fails, keeps the row, and a retry reuses the same key', async () => {
    const user = userEvent.setup();
    deletedExpensesBackend(deletedExpenseList(ROWS));
    const sent = restoreExpenseBackend(() => problemResponse(500));
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(await screen.findByText("Couldn't restore Shop rent for October")).toBeVisible();
    expect(screen.getByText(/Something went wrong/)).toBeVisible();
    expect(screen.getByText('Shop rent for October')).toBeVisible();

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    await waitFor(() => {
      expect(sent.keys).toHaveLength(2);
    });
    expect(sent.keys[1]).toBe(sent.keys[0]);
  });

  it('gives a different expense its own key', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedExpensesBackend(() => deletedExpenseList(ROWS.filter((row) => !gone.has(row.id))));
    const sent = restoreExpenseBackend((id) => {
      gone.add(id);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));
    await waitFor(() => {
      expect(screen.queryByText('Shop rent for October')).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: RESTORE_SECOND }));

    await waitFor(() => {
      expect(sent.ids).toEqual([FIRST_ID, SECOND_ID]);
    });
    expect(sent.keys[0]).not.toBe(sent.keys[1]);
  });
});

describe('the list states (UI Considerations)', () => {
  it('announces Loading deleted expenses on the first load, then shows the rows', async () => {
    deletedExpensesBackend(async () => {
      await delay(150);
      return deletedExpenseList(ROWS);
    });
    renderPage();

    expect(await screen.findByText('Loading deleted expenses…')).toBeInTheDocument();
    await screen.findByText('Shop rent for October');
    expect(screen.queryByText('Loading deleted expenses…')).toBeNull();
  });

  it("shows Couldn't load deleted expenses with Try Again, and Try Again reads the list again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    deletedExpensesBackend(() => {
      calls += 1;
      return calls === 1 ? problemResponse(500) : deletedExpenseList(ROWS);
    });
    const view = renderPage();

    expect(await screen.findByText("Couldn't load deleted expenses.")).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByText('Shop rent for October');
    expect(calls).toBe(2);
  });

  it('shows No deleted expenses with its message, the archive icon and no action when nothing was ever deleted', async () => {
    deletedExpensesBackend(deletedExpenseList([]));
    const view = renderPage();

    const title = await screen.findByRole('heading', { name: 'No deleted expenses' });
    expect(title).toBeVisible();
    expect(
      screen.getByText("When a Manager deletes an expense, it shows here until it's restored or deleted permanently."),
    ).toBeVisible();
    expect(view.container.querySelector('.lucide-archive')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoAxeViolations(view.container);
  });

  it('shows No matches with Clear Filters for a filtered empty result, and Clear Filters clears the search and the category', async () => {
    const user = userEvent.setup();
    const { calls } = deletedExpensesBackend((url) =>
      url.searchParams.has('q') ? deletedExpenseList([]) : deletedExpenseList(ROWS),
    );
    renderPage('?q=zzz');

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));

    await screen.findByText('Shop rent for October');
    expect(calls.at(-1)?.searchParams.has('q')).toBe(false);
  });

  it('shows the access banner instead of the table when the API answers 403', async () => {
    deletedExpensesBackend(() => problemResponse(403));
    renderPage();

    expect(await screen.findByText("You don't have access to this")).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('accessibility', () => {
  it('has no axe violations with rows, and while loading', async () => {
    deletedExpensesBackend(async () => {
      await delay(100);
      return deletedExpenseList([
        ...ROWS,
        deletedExpenseItem('00000000-0000-4000-8000-000000000004', { paidBy: CARMEN, description: 'Printer ink' }),
      ]);
    });
    const view = renderPage();

    await screen.findByText('Loading deleted expenses…');
    await expectNoAxeViolations(view.container);
    await screen.findByText('Shop rent for October');
    await expectNoAxeViolations(view.container);
  });
});

describe('Delete permanently from the deleted list (D-04, D-05; plan 06-16)', () => {
  const PURGE_FIRST = 'Delete Shop rent for October, Oct 6, 2026 permanently';
  const PURGE_THIRD = 'Delete Meralco bill, Oct 4, 2026 permanently';
  const PURGE_TITLE = 'Delete “Shop rent for October” (₱12,450.00) permanently?';

  function listThatLoses(gone: Set<string>) {
    return () => deletedExpenseList(ROWS.filter((row) => !gone.has(row.id)));
  }

  it('gives each row Restore, then Delete permanently with the eraser, named with the description and date and a matching title', async () => {
    deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    const rent = screen.getAllByRole('row').find((row) => within(row).queryByText('Shop rent for October') !== null);
    if (rent === undefined) throw new Error('No rent row');
    const names = within(rent)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(names).toEqual([RESTORE_FIRST, PURGE_FIRST]);
    const purge = screen.getByRole('button', { name: PURGE_FIRST });
    expect(purge).toHaveAttribute('title', PURGE_FIRST);
    expect(purge.querySelector('svg')).toHaveClass('lucide-eraser');
  });

  it('opens the permanent confirmation with its title and message and Cancel focused, and sends nothing yet', async () => {
    const user = userEvent.setup();
    deletedExpensesBackend(deletedExpenseList(ROWS));
    const sent = purgeExpenseBackend();
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));

    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    expect(
      within(dialog).getByText(
        "This removes the expense for good. It can't be restored, and this can't be undone. The audit log keeps its date, category, amount and payer.",
      ),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(sent.ids).toEqual([]);
  });

  it('confirming sends the permanent DELETE, drops the row, moves focus to the next row Restore, reads the lists again and toasts', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const { calls } = deletedExpensesBackend(listThatLoses(gone));
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

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));
    await user.click(
      within(await screen.findByRole('dialog', { name: PURGE_TITLE })).getByRole('button', {
        name: 'Delete Permanently',
      }),
    );

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('Shop rent for October')).toBeNull();
    });
    expect(sent.ids).toEqual([FIRST_ID]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
    expect(await screen.findByText('Expense permanently deleted')).toBeVisible();
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(reads);
    });
    expect(invalidated).toEqual(
      expect.arrayContaining([expensesKey, expenseKpisKey, expensesDeletedKey, expenseCategoriesKey]),
    );
  });

  it('moves focus to the previous Restore when the last row was deleted for good', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedExpensesBackend(listThatLoses(gone));
    purgeExpenseBackend((id) => {
      gone.add(id);
      return new Response(null, { status: 204 });
    });
    renderPage();
    await screen.findByText('Meralco bill');

    await user.click(screen.getByRole('button', { name: PURGE_THIRD }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Permanently' }));

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('Meralco bill')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
  });

  it('keeps the dialog open on a server failure with the mapper line, and closes on a 404 with the already-deleted note', async () => {
    const user = userEvent.setup();
    deletedExpensesBackend(deletedExpenseList(ROWS));
    let answer: Response = problemResponse(500);
    purgeExpenseBackend(() => answer);
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));
    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Permanently' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Something went wrong/);
    expect(within(dialog).getByRole('button', { name: 'Delete Permanently' })).toHaveFocus();

    answer = problemResponse(404);
    await user.click(within(dialog).getByRole('button', { name: 'Delete Permanently' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByText('Already deleted')).toBeVisible();
  });

  it('has no axe violations with the permanent confirmation open', async () => {
    const user = userEvent.setup();
    deletedExpensesBackend(deletedExpenseList(ROWS));
    renderPage();
    await screen.findByText('Shop rent for October');

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));
    await screen.findByRole('dialog', { name: PURGE_TITLE });
    await expectNoAxeViolations(document.body);
  });
});
