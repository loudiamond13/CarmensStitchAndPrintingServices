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
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { ordersDeletedKey } from '@/modules/admin/hooks/useRefreshOrders';
import DeletedOrdersPage from '@/modules/admin/pages/DeletedOrdersPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { deletedOrderItem, deletedOrderList, deletedOrdersBackend, deletedProblem } from '@/test/deletedOrderFixtures';
import { orderId } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// X1 Deleted Orders, /admin/orders/deleted (ORD-06, D-23, D-52; plan 08-20): a Manager finds a deleted order and brings it back.

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

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter initialEntries={[`/admin/orders/deleted${search}`]}>
          <ToastProvider>
            <DeletedOrdersPage />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

const FIRST_ID = orderId(148);
const SECOND_ID = orderId(151);
const THIRD_ID = orderId(153);

const ROWS = [
  deletedOrderItem(FIRST_ID),
  deletedOrderItem(SECOND_ID, {
    number: 'ORD-2026-0151',
    customerName: 'Mark Villanueva',
    teamName: 'Tondo Riders MC',
    status: 'ready',
    total: 8000,
    paid: 8000,
    balance: 0,
    deletedAt: '2026-10-11T02:05:00Z',
    deletedBy: { id: orderId(77), name: 'Lito Cruz', formerStaff: true },
  }),
  deletedOrderItem(THIRD_ID, {
    number: 'ORD-2026-0153',
    customerName: 'Ana Lopez',
    teamName: null,
    status: 'pending',
    total: 1500,
    paid: 500,
    balance: 1000,
    deletedBy: null,
  }),
];

const RESTORE_FIRST = 'Restore order ORD-2026-0148';
const RESTORE_SECOND = 'Restore order ORD-2026-0151';
const RESTORE_THIRD = 'Restore order ORD-2026-0153';

/** The list drops the restored rows once the POST has been answered. */
function listThatLoses(gone: Set<string>) {
  return () => deletedOrderList(ROWS.filter((row) => !gone.has(row.id)));
}

describe('the page', () => {
  it('shows the back link, the heading with the Manager only badge, the subline and the result bar, and no search', async () => {
    deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage();

    const back = screen.getByRole('link', { name: 'Back to Orders' });
    expect(back).toHaveAttribute('href', '/admin/orders');
    const heading = screen.getByRole('heading', { level: 1, name: 'Deleted Orders' });
    expect(heading).toBeVisible();
    expect(within(heading.parentElement ?? document.body).getByText('Manager only')).toBeVisible();
    expect(
      screen.getByText(
        "Deleted orders don't count in lists, totals or balances. Restore one to count it again, or delete it permanently.",
      ),
    ).toBeVisible();
    await screen.findByText('ORD-2026-0151');
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 3 deleted orders · most recently deleted first');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(document.title).toBe('Deleted Orders · CSPS Admin');
  });

  it('shows the Deleted orders table with its nine columns in order', async () => {
    deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage();

    const table = await screen.findByRole('table', { name: 'Deleted orders' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Deleted',
      'Order',
      'Customer',
      'Status',
      'Total',
      'Paid',
      'Balance',
      'Deleted by',
      'Actions',
    ]);
  });

  it('keeps the rows in the order the server sent them, newest deleted first', async () => {
    deletedOrdersBackend({ list: deletedOrderList([...ROWS].reverse()) });
    renderPage();

    const table = await screen.findByRole('table', { name: 'Deleted orders' });
    const numbers = within(table)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(numbers).toEqual(['ORD-2026-0153', 'ORD-2026-0151', 'ORD-2026-0148']);
  });

  it('reads each row: the delete time in Manila time, the order link, team over customer, status, money and the deleter', async () => {
    deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage();

    await screen.findByText('ORD-2026-0148');
    const first = screen.getAllByRole('row').find((row) => within(row).queryByText('ORD-2026-0148') !== null);
    if (first === undefined) throw new Error('No first row');
    const time = first.querySelector('td[data-label="Deleted"] time');
    expect(time?.textContent).toBe('Oct 12, 2026, 3:42 PM');
    expect(time).toHaveAttribute('datetime', '2026-10-12T07:42:00Z');
    expect(within(first).getByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      `/admin/orders/deleted/${FIRST_ID}`,
    );
    const customer = first.querySelector('td[data-label="Customer"]');
    expect(customer?.textContent).toContain('Brgy. San Roque Ballers');
    expect(customer?.textContent).toContain('Juan Dela Cruz');
    expect(within(first).getByText('In Production')).toBeVisible();
    expect(first.querySelector('td[data-label="Total"]')?.textContent).toBe('₱21,327.50');
    expect(first.querySelector('td[data-label="Paid"]')?.textContent).toBe('₱12,000.00');
    expect(first.querySelector('td[data-label="Balance"]')?.textContent).toBe('₱9,327.50');
    expect(first.querySelector('td[data-label="Deleted by"]')?.textContent).toContain('Carmen Reyes');

    const second = screen.getAllByRole('row').find((row) => within(row).queryByText('ORD-2026-0151') !== null);
    expect(second?.querySelector('td[data-label="Deleted by"]')?.textContent).toContain('Lito Cruz');
    expect(second?.querySelector('td[data-label="Deleted by"]')?.textContent).toContain('(former staff)');
  });

  it('names View and Restore with the order number, with a matching title', async () => {
    deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    const view = screen.getByRole('button', { name: 'View deleted order ORD-2026-0148' });
    expect(view).toHaveAttribute('title', 'View deleted order ORD-2026-0148');
    expect(view.querySelector('svg')).toHaveClass('lucide-eye');
    const restore = screen.getByRole('button', { name: RESTORE_FIRST });
    expect(restore).toHaveAttribute('title', RESTORE_FIRST);
    expect(restore.querySelector('svg')).toHaveClass('lucide-rotate-ccw');
  });

  it('says 1 deleted order for one row', async () => {
    deletedOrdersBackend({ list: deletedOrderList(ROWS.slice(0, 1)) });
    renderPage();

    await screen.findByText('ORD-2026-0148');
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 1 deleted order · most recently deleted first');
  });

  it('sends the page and size from the URL and nothing else', async () => {
    const backend = deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage('?page=2&size=10&q=juan');

    await screen.findByText('ORD-2026-0148');
    expect(Object.fromEntries(backend.lists.at(-1)?.searchParams ?? [])).toEqual({ page: '2', pageSize: '10' });
  });
});

describe('Restore (D-23)', () => {
  it('acts at once with no confirmation: sends the POST with an Idempotency-Key, drops the row, moves focus to the next Restore and toasts', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const backend = deletedOrdersBackend({
      list: listThatLoses(gone),
      restore: (id) => {
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');
    const reads = backend.lists.length;

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByText('ORD-2026-0148')).toBeNull();
    });
    expect(backend.restores.map((call) => call.id)).toEqual([FIRST_ID]);
    expect(backend.restores[0]?.key).toMatch(/\S/);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
    expect(await screen.findByText('Order restored')).toBeVisible();
    expect(screen.getByText('ORD-2026-0148 counts in lists and totals again.')).toBeVisible();
    await waitFor(() => {
      expect(backend.lists.length).toBeGreaterThan(reads);
    });
    expect(invalidated).toEqual(expect.arrayContaining([ordersKey, ordersDeletedKey]));
  });

  it('moves focus to the previous Restore when the last row was restored', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedOrdersBackend({
      list: listThatLoses(gone),
      restore: (id) => {
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0153');

    await user.click(screen.getByRole('button', { name: RESTORE_THIRD }));

    await waitFor(() => {
      expect(screen.queryByText('ORD-2026-0153')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
  });

  it('moves focus to the heading when the list empties', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedOrdersBackend({
      list: () => deletedOrderList(ROWS.slice(0, 1).filter((row) => !gone.has(row.id))),
      restore: (id) => {
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(await screen.findByText('No deleted orders')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Deleted Orders' })).toHaveFocus();
    });
  });

  it('sends one request for a double click', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const backend = deletedOrdersBackend({
      list: listThatLoses(gone),
      restore: async (id) => {
        await delay(80);
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.dblClick(screen.getByRole('button', { name: RESTORE_FIRST }));

    await waitFor(() => {
      expect(screen.queryByText('ORD-2026-0148')).toBeNull();
    });
    expect(backend.restores).toHaveLength(1);
  });

  it('shows a persistent danger toast when Restore fails, keeps the row, and a retry reuses the same Idempotency-Key', async () => {
    const user = userEvent.setup();
    const backend = deletedOrdersBackend({ list: deletedOrderList(ROWS), restore: () => deletedProblem(500) });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(await screen.findByText("Couldn't restore ORD-2026-0148")).toBeVisible();
    expect(screen.getByText(/Something went wrong/)).toBeVisible();
    expect(screen.getByText('ORD-2026-0148')).toBeVisible();

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    await waitFor(() => {
      expect(backend.restores).toHaveLength(2);
    });
    expect(backend.restores[1]?.key).toBe(backend.restores[0]?.key);
  });

  it('gives a different order its own Idempotency-Key', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const backend = deletedOrdersBackend({
      list: listThatLoses(gone),
      restore: (id) => {
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));
    await waitFor(() => {
      expect(screen.queryByText('ORD-2026-0148')).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: RESTORE_SECOND }));

    await waitFor(() => {
      expect(backend.restores.map((call) => call.id)).toEqual([FIRST_ID, SECOND_ID]);
    });
    expect(backend.restores[0]?.key).not.toBe(backend.restores[1]?.key);
  });

  it('reads the list again when Restore answers 404, so an order removed meanwhile leaves the table', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedOrdersBackend({
      list: listThatLoses(gone),
      restore: (id) => {
        gone.add(id);
        return deletedProblem(404);
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.click(screen.getByRole('button', { name: RESTORE_FIRST }));

    expect(await screen.findByText("Couldn't restore ORD-2026-0148")).toBeVisible();
    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('ORD-2026-0148')).toBeNull();
    });
  });
});

describe('Delete permanently from the deleted list (07 D-28, D-57; plan 08-20)', () => {
  const PURGE_FIRST = 'Delete order ORD-2026-0148 permanently';
  const PURGE_THIRD = 'Delete order ORD-2026-0153 permanently';
  const PURGE_TITLE = 'Delete ORD-2026-0148 permanently?';
  const PURGE_THIRD_TITLE = 'Delete ORD-2026-0153 permanently?';

  it('gives each row View, Restore, then Delete permanently with the eraser, named with the order number and a matching title', async () => {
    deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    const first = screen.getAllByRole('row').find((row) => within(row).queryByText('ORD-2026-0148') !== null);
    if (first === undefined) throw new Error('No first row');
    const names = within(first)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(names).toEqual(['View deleted order ORD-2026-0148', RESTORE_FIRST, PURGE_FIRST]);
    const purge = screen.getByRole('button', { name: PURGE_FIRST });
    expect(purge).toHaveAttribute('title', PURGE_FIRST);
    expect(purge.querySelector('svg')).toHaveClass('lucide-eraser');
  });

  it('opens the dialog, which reads the counts first, and sends nothing until the number is typed', async () => {
    const user = userEvent.setup();
    const backend = deletedOrdersBackend({ list: deletedOrderList(ROWS) });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));

    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    expect(
      within(dialog).getByText(
        'Brgy. San Roque Ballers · Juan Dela Cruz. The order and everything inside it are removed for good.',
      ),
    ).toBeVisible();
    expect(await within(dialog).findByText(/^This will also delete 5 items/)).toBeVisible();
    expect(backend.reads).toEqual([FIRST_ID]);
    expect(within(dialog).getByRole('button', { name: 'Delete Order Permanently' })).toBeDisabled();
    expect(backend.purges).toEqual([]);
  });

  it('confirming sends the DELETE with confirm=, drops the row, moves focus to the next row Restore, reads the lists again and toasts', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    const backend = deletedOrdersBackend({
      list: listThatLoses(gone),
      purge: (id) => {
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');
    const reads = backend.lists.length;

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));
    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    await within(dialog).findByText(/^This will also delete/);
    await user.type(within(dialog).getByRole('textbox'), 'ORD-2026-0148');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Order Permanently' }));

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('ORD-2026-0148')).toBeNull();
    });
    expect(backend.purges).toEqual([{ id: FIRST_ID, confirm: 'ORD-2026-0148', key: null }]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
    expect(await screen.findByText('Order permanently deleted')).toBeVisible();
    await waitFor(() => {
      expect(backend.lists.length).toBeGreaterThan(reads);
    });
  });

  it('moves focus to the previous Restore when the last row was deleted for good', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedOrdersBackend({
      list: listThatLoses(gone),
      purge: (id) => {
        gone.add(id);
        return new Response(null, { status: 204 });
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0153');

    await user.click(screen.getByRole('button', { name: PURGE_THIRD }));
    const dialog = await screen.findByRole('dialog', { name: PURGE_THIRD_TITLE });
    await within(dialog).findByText(/^This will also delete/);
    await user.type(within(dialog).getByRole('textbox'), 'ORD-2026-0153');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Order Permanently' }));

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('ORD-2026-0153')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: RESTORE_SECOND })).toHaveFocus();
    });
  });

  it('closes with the already-gone note and reads the list again when the order was removed meanwhile (404)', async () => {
    const user = userEvent.setup();
    const gone = new Set<string>();
    deletedOrdersBackend({
      list: listThatLoses(gone),
      purge: (id) => {
        gone.add(id);
        return deletedProblem(404);
      },
    });
    renderPage();
    await screen.findByText('ORD-2026-0148');

    await user.click(screen.getByRole('button', { name: PURGE_FIRST }));
    const dialog = await screen.findByRole('dialog', { name: PURGE_TITLE });
    await within(dialog).findByText(/^This will also delete/);
    await user.type(within(dialog).getByRole('textbox'), 'ORD-2026-0148');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Order Permanently' }));

    expect(await screen.findByText('Already gone')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('ORD-2026-0148')).toBeNull();
    });
  });
});
