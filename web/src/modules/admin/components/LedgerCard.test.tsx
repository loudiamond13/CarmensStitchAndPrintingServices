import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { LedgerCard } from '@/modules/admin/components/LedgerCard';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  deleteTransferBackend,
  JOMAR_ID,
  LEDGER_TRANSFER_ID,
  staffBalancesBackend,
  ledgerBackend,
  ledgerDeletedEntryFixture,
  ledgerEntriesFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
  type LedgerEntryFixture,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Ledger card (D-41, D-30, D-31, WEB-10; plan 10-17): the head, Show deleted for a Manager, the result bar, the table, paging, and
// the states. Its place (page, rows per page, Show deleted) lives in the URL.

let queryClient: QueryClient;

const ADMIN_USER = {
  id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  email: 'lito@example.ph',
  firstName: 'Lito',
  lastName: 'Santos',
  role: 'Admin',
};

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function renderCard(
  search = '',
  onUrlUpdate: OnUrlUpdateFunction = () => undefined,
  userId = 'me',
  ownerName?: string,
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <ToastProvider>
          <MemoryRouter>
            <LedgerCard userId={userId} ownerName={ownerName} />
          </MemoryRouter>
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

/** The body rows of the table. */
function bodyRows(): HTMLElement[] {
  return within(screen.getByRole('table', { name: 'Ledger' }))
    .getAllByRole('row')
    .slice(1);
}

/** One cell of one body row. */
function cellAt(row: number, column: number): HTMLElement {
  const cell = bodyRows().at(row)?.querySelectorAll<HTMLElement>('td')[column];
  if (cell === undefined) throw new Error(`No cell at row ${String(row)}, column ${String(column)}.`);
  return cell;
}

/** A server that holds `total` payment rows and answers any page or size by slicing them. */
function pagedLedger(total: number) {
  const rows: LedgerEntryFixture[] = Array.from({ length: total }, (_unused, index) =>
    ledgerEntryFixture({
      kind: 'company-expense',
      moneyIn: null,
      moneyOut: 10 + index,
      balanceAfter: 5000 - index,
      description: `Bill ${String(index + 1)}`,
    }),
  );
  return (url: URL) => {
    const page = Number(url.searchParams.get('page') ?? '1');
    const size = Number(url.searchParams.get('pageSize') ?? '20');
    return ledgerPageFixture(rows.slice((page - 1) * size, page * size), { total, page, pageSize: size });
  };
}

const HEADER_NOTE = 'Newest first. The balance after each entry is shown on the right.';

describe('the card', () => {
  it('shows the Ledger heading and its line over the result bar and the rows', async () => {
    ledgerBackend();
    renderCard();

    expect(screen.getByRole('heading', { level: 2, name: 'Ledger' })).toBeVisible();
    expect(screen.getByText(HEADER_NOTE)).toBeVisible();
    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 6 entries · newest first');
  });

  it('reads "Showing 1 entry · newest first" for a single row', async () => {
    ledgerBackend(ledgerPageFixture(ledgerEntriesFixture().slice(0, 1)));
    renderCard();

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 entry · newest first');
  });

  it('has no axe violations', async () => {
    ledgerBackend();
    const { container } = renderCard();

    await screen.findByRole('table', { name: 'Ledger' });
    await expectNoAxeViolations(container);
  });
});

describe('Show deleted (D-30, D-31, D-23)', () => {
  it('shows a Manager an unticked "Show deleted" and asks for no deleted transfers at first', async () => {
    const calls = ledgerBackend();
    renderCard();

    const box = await screen.findByRole('checkbox', { name: 'Show deleted' });
    expect(box).not.toBeChecked();
    await screen.findByRole('table', { name: 'Ledger' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.searchParams.has('deleted')).toBe(false);
  });

  it('asks for deleted=true when a Manager ticks it, replaces the URL, and words the result bar for deleted transfers', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const calls = ledgerBackend((url) =>
      url.searchParams.get('deleted') === 'true'
        ? ledgerPageFixture([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()], { includesDeleted: true })
        : ledgerPageFixture(),
    );
    renderCard('?page=1', onUrlUpdate);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'Show deleted' }));

    await waitFor(() => {
      expect(screen.getByText(/^Showing/)).toHaveTextContent(
        'Showing 7 entries, deleted transfers included · newest first',
      );
    });
    expect(calls.at(-1)?.searchParams.get('deleted')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Show deleted' })).toBeChecked();
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toContainEqual([
      'replace',
      '?deleted=true',
    ]);
  });

  it('words the result bar from the rows on screen, not from the checkbox, while the other answer loads (IN-02)', async () => {
    ledgerBackend(async (url) => {
      if (url.searchParams.get('deleted') === 'true') {
        await delay(500);
        return ledgerPageFixture([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()], { includesDeleted: true });
      }
      return ledgerPageFixture();
    });
    renderCard();
    const user = userEvent.setup();

    expect(await screen.findByText(/^Showing/)).toHaveTextContent('Showing 6 entries · newest first');
    await user.click(screen.getByRole('checkbox', { name: 'Show deleted' }));
    expect(screen.getByRole('checkbox', { name: 'Show deleted' })).toBeChecked();
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 6 entries · newest first');
    await waitFor(() => {
      expect(screen.getByText(/^Showing/)).toHaveTextContent(
        'Showing 7 entries, deleted transfers included · newest first',
      );
    });

    await user.click(screen.getByRole('checkbox', { name: 'Show deleted' }));
    await waitFor(() => {
      expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 6 entries · newest first');
    });
  });

  it('reads Show deleted from the URL and asks for deleted transfers on the first read', async () => {
    const calls = ledgerBackend(ledgerPageFixture([ledgerDeletedEntryFixture()], { includesDeleted: true }));
    renderCard('?deleted=true');

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.getByRole('checkbox', { name: 'Show deleted' })).toBeChecked();
    expect(calls[0]?.searchParams.get('deleted')).toBe('true');
  });

  it('draws a deleted transfer with the Deleted badge, a muted struck amount, who deleted it and when, and "Not counted"', async () => {
    ledgerBackend(
      ledgerPageFixture([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()], { includesDeleted: true }),
    );
    renderCard('?deleted=true');

    await screen.findByRole('table', { name: 'Ledger' });
    const details = cellAt(0, 1);
    expect(within(details).getByText('Deleted')).toBeVisible();
    expect(details).toHaveTextContent('Transfer to Liza Mercado');
    expect(details).toHaveTextContent('Deleted by Carmen Reyes · Oct 8, 2026, 3:42 PM');
    const amount = within(cellAt(0, 3)).getByText('₱2,000.00');
    expect(amount.closest('span.line-through')).not.toBeNull();
    expect(amount.closest('span.text-ink-muted')).not.toBeNull();
    expect(within(cellAt(0, 4)).getByText('Not counted')).toBeVisible();
    expect(cellAt(1, 4)).not.toHaveTextContent('Not counted');
  });

  it('shows the same EmptyState with Show deleted on and still nothing', async () => {
    ledgerBackend(ledgerPageFixture([], { includesDeleted: true }));
    renderCard('?deleted=true');

    expect(await screen.findByText('No money in or out yet')).toBeVisible();
    expect(screen.getByText('Payments you receive, transfers and expenses you pay show here.')).toBeVisible();
  });

  it('shows an Admin no Show deleted, and no request ever carries deleted, even with deleted=true in the URL', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const calls = ledgerBackend();
    renderCard('?deleted=true', onUrlUpdate);

    await screen.findByRole('table', { name: 'Ledger' });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.searchParams.has('deleted')).toBe(false);
    }
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toEqual([
      ['replace', ''],
    ]);
  });

  it('keeps an Admin on the same page when it drops deleted=true, and sends one kind of request only (IN-03)', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const calls = ledgerBackend(pagedLedger(45));
    renderCard('?page=3&size=10&deleted=true', onUrlUpdate);

    await screen.findByText('Bill 21');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toEqual([
      ['replace', '?page=3&size=10'],
    ]);
    expect(calls.map((call) => [call.searchParams.get('page'), call.searchParams.has('deleted')])).toEqual([
      ['3', false],
    ]);
  });

  it('offers a Manager no edit or restore action on any row (D-22, D-28, MONEY-07); only Delete and Remove on transfers', async () => {
    ledgerBackend(
      ledgerPageFixture([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()], { includesDeleted: true }),
    );
    renderCard('?deleted=true');

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.queryByRole('button', { name: /edit|restore/i })).toBeNull();
    const names = within(screen.getByRole('table', { name: 'Ledger' }))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toHaveLength(3);
    for (const name of names) {
      expect(name).toMatch(/^(Delete|Remove) transfer of /);
    }
  });
});

describe('paging (WEB-10)', () => {
  it('asks for page 2 when the URL says page=2', async () => {
    const calls = ledgerBackend(pagedLedger(45));
    renderCard('?page=2');

    await screen.findByRole('table', { name: 'Ledger' });
    expect(calls[0]?.searchParams.get('page')).toBe('2');
    expect(calls[0]?.searchParams.get('pageSize')).toBe('20');
    expect(screen.getByText('Bill 21')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
  });

  it('pushes a history entry for Next and asks for the next page', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const calls = ledgerBackend(pagedLedger(45));
    renderCard('', onUrlUpdate);
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Ledger' });
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await screen.findByText('Bill 21');
    expect(calls.at(-1)?.searchParams.get('page')).toBe('2');
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toContainEqual([
      'push',
      '?page=2',
    ]);
  });

  it('replaces a page past the last with the last page', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    ledgerBackend(pagedLedger(45));
    renderCard('?page=9', onUrlUpdate);

    await waitFor(() => {
      expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toContainEqual([
        'replace',
        '?page=3',
      ]);
    });
    expect(await screen.findByText('Bill 41')).toBeVisible();
  });

  it('never says "No money in or out yet" while a page past the last is replaced by the last page (WR-01)', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const answer = pagedLedger(15);
    ledgerBackend(async (url) => {
      if (url.searchParams.get('page') === '2') await delay(600);
      return answer(url);
    });
    renderCard('?page=3&size=10', onUrlUpdate);

    await waitFor(() => {
      expect(onUrlUpdate.mock.calls.map(([event]) => event.queryString)).toContain('?page=2&size=10');
    });
    expect(screen.queryByText('No money in or out yet')).toBeNull();
    expect(screen.queryByText(/^Showing/)).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
    expect(screen.getByText('Loading the ledger…')).toBeInTheDocument();
    expect(await screen.findByText('Bill 11')).toBeVisible();
    expect(screen.queryByText('No money in or out yet')).toBeNull();
  });

  it('offers 10, 20, 50 and 100 rows per page, and a size change replaces the URL, resets the page and asks for that size', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const calls = ledgerBackend(pagedLedger(250));
    renderCard('?page=3', onUrlUpdate);
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Ledger' });
    const select = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '20', '50', '100']);
    await user.selectOptions(select, '50');

    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('pageSize')).toBe('50');
    });
    expect(calls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toContainEqual([
      'replace',
      '?size=50',
    ]);
  });

  it('keeps "Rows per page" after a size that fits every row, so a smaller size can be chosen again (WR-02)', async () => {
    const calls = ledgerBackend(pagedLedger(30));
    renderCard('?size=20');
    const user = userEvent.setup();

    await screen.findByText('Bill 1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('pageSize')).toBe('50');
    });
    await screen.findByText('Bill 30');
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
    const select = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(select).toHaveValue('50');
    await user.selectOptions(select, '10');

    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('pageSize')).toBe('10');
    });
    await screen.findByText('Bill 10');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1 of 3');
  });

  it('offers no "Rows per page" when every row would fit the smallest size anyway', async () => {
    ledgerBackend(pagedLedger(10));
    renderCard();

    await screen.findByText('Bill 1');
    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).toBeNull();
  });

  it('keeps the rows on screen, dimmed after 200 ms, while the next page loads', async () => {
    const answer = pagedLedger(45);
    ledgerBackend(async (url) => {
      if (url.searchParams.get('page') === '2') await delay(700);
      return answer(url);
    });
    const user = userEvent.setup();
    renderCard();

    await screen.findByText('Bill 1');
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    const frame = screen.getByRole('table', { name: 'Ledger' }).closest('[role="region"]');
    if (frame === null) throw new Error('The table has no frame.');
    await waitFor(() => {
      expect(frame).toHaveAttribute('data-refetching', 'true');
    });
    expect(screen.getByText('Bill 1')).toBeVisible();
    await screen.findByText('Bill 21');
    expect(frame).not.toHaveAttribute('data-refetching', 'true');
  });
});

describe('states', () => {
  it('shows "No money in or out yet" with its line and no button when there is nothing', async () => {
    ledgerBackend(ledgerPageFixture([]));
    renderCard();

    expect(await screen.findByText('No money in or out yet')).toBeVisible();
    expect(screen.getByText('Payments you receive, transfers and expenses you pay show here.')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/^Showing/)).toBeNull();
  });

  it('shows another person\'s empty ledger with the title only, so the line does not speak to "you" (wave 8 IN-08)', async () => {
    const calls = ledgerBackend(ledgerPageFixture([]), 'someone');
    renderCard('', undefined, 'someone');

    expect(await screen.findByText('No money in or out yet')).toBeVisible();
    expect(screen.queryByText(/Payments you receive/)).toBeNull();
    expect(calls[0]?.pathname).toBe('/api/v1/staff-money/someone/ledger');
  });

  it('shows "Loading the ledger…" with the skeleton, then the rows, and says the ledger loaded', async () => {
    ledgerBackend(async () => {
      await delay(300);
      return ledgerPageFixture();
    });
    renderCard();

    expect(screen.getByText('Loading the ledger…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Ledger' })).toBeVisible();
    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.getByText('The ledger loaded.')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load the ledger." with Try Again, which reads the ledger again', async () => {
    let answered = 0;
    const calls = ledgerBackend(() => {
      answered += 1;
      return answered === 1 ? problemResponse(500) : ledgerPageFixture();
    });
    renderCard();
    const user = userEvent.setup();

    expect(await screen.findByText("Couldn't load the ledger.")).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Ledger' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByRole('table', { name: 'Ledger' });
    expect(calls).toHaveLength(2);
    expect(screen.queryByText("Couldn't load the ledger.")).toBeNull();
  });

  it('shows the failure line, not a wrong row, when a figure is not a plain decimal', async () => {
    ledgerBackend(ledgerPageFixture([ledgerEntryFixture({ moneyIn: 'abc' })]));
    renderCard();

    expect(await screen.findByText("Couldn't load the ledger.")).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('has no axe violations in the error state', async () => {
    ledgerBackend(() => problemResponse(500));
    const { container } = renderCard();

    await screen.findByText("Couldn't load the ledger.");
    await expectNoAxeViolations(container);
  });
});

// The Manager's Delete and Remove on transfer rows (D-22, D-29, D-30, MONEY-06; plan 10-20): the same confirms as the Transfers tab,
// with the ledger owner named from the session (My Money) or from the page (one person's ledger).

const DELETE_OUT = 'Delete transfer of ₱2,000.00 from Carmen Reyes to Liza Mercado, Nov 2, 2026';
const DELETE_IN = 'Delete transfer of ₱2,000.00 from Paolo Garcia to Carmen Reyes, Nov 1, 2026';

describe('the Manager row actions on transfers (plan 10-20)', () => {
  beforeEach(() => {
    staffBalancesBackend();
  });

  it('opens the Delete confirm for the row, sends its version, reads the ledger again and toasts', async () => {
    let deleted = false;
    const calls = ledgerBackend(() => {
      const rows = ledgerEntriesFixture();
      return ledgerPageFixture(deleted ? rows.filter((row) => row.transferId !== LEDGER_TRANSFER_ID) : rows);
    });
    const deletions = deleteTransferBackend(() => {
      deleted = true;
      return new Response(null, { status: 204 });
    });
    renderCard();
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Ledger' });
    await user.click(screen.getByRole('button', { name: DELETE_OUT }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(dialog).toHaveTextContent('₱2,000.00 from Carmen Reyes to Liza Mercado, Nov 2, 2026.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    expect(await screen.findByText('Transfer deleted')).toBeVisible();
    expect(deletions.urls[0]?.pathname).toBe(`/api/v1/money-transfers/${LEDGER_TRANSFER_ID}`);
    expect(deletions.urls[0]?.searchParams.get('version')).toBe('AAAAAAAAB9E=');
    await waitFor(() => {
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: DELETE_OUT })).toBeNull();
    });
  });

  it("moves focus to the next transfer row's action once the deleted row has left the ledger", async () => {
    let deleted = false;
    ledgerBackend(() => {
      const rows = ledgerEntriesFixture();
      return ledgerPageFixture(deleted ? rows.filter((row) => row.transferId !== LEDGER_TRANSFER_ID) : rows);
    });
    deleteTransferBackend(() => {
      deleted = true;
      return new Response(null, { status: 204 });
    });
    renderCard();
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Ledger' });
    await user.click(screen.getByRole('button', { name: DELETE_OUT }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: DELETE_IN })).toHaveFocus();
    });
  });

  it('names another person as the owner of their ledger, from the page', async () => {
    ledgerBackend(ledgerPageFixture(), JOMAR_ID);
    renderCard('', undefined, JOMAR_ID, 'Jomar Santos');

    await screen.findByRole('table', { name: 'Ledger' });
    expect(
      screen.getByRole('button', {
        name: 'Delete transfer of ₱2,000.00 from Jomar Santos to Liza Mercado, Nov 2, 2026',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Delete transfer of ₱2,000.00 from Paolo Garcia to Jomar Santos, Nov 1, 2026',
      }),
    ).toBeVisible();
  });

  it('draws no Actions column on another ledger whose owner the page has not named', async () => {
    ledgerBackend(ledgerPageFixture(), JOMAR_ID);
    renderCard('', undefined, JOMAR_ID);

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives an Admin no Actions column and no button, even on transfer rows (D-31, D-32, T-10-45)', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    ledgerBackend();
    renderCard();

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
