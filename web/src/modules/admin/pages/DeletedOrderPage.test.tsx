import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import DeletedOrderPage from '@/modules/admin/pages/DeletedOrderPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  deletedOrderDetail,
  deletedOrdersBackend,
  deletedOrderList,
  deletedProblem,
  type DeletedOrderDetailFixture,
  type DeletedOrdersOptions,
} from '@/test/deletedOrderFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { buildOrderDetail, creditOrder, order0148, orderRefund } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// X2 Deleted order, /admin/orders/deleted/:id (ORD-06, ORD-07, D-24, D-57; plan 08-23): the order page with every write removed, a
// banner saying who deleted it and when, and only Restore Order and Delete Order Permanently.

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

interface RenderOptions {
  search?: string;
  onUrlUpdate?: OnUrlUpdateFunction | undefined;
  id?: string;
}

/** Opens the deleted view in a data router, with the lists and the live order page as stand-ins to land on. */
function renderPage({ search = '', onUrlUpdate, id = order0148.id }: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      { path: '/admin/orders', element: <p>The orders list</p> },
      { path: '/admin/orders/deleted', element: <p>The deleted list</p> },
      { path: '/admin/orders/deleted/:id', element: <DeletedOrderPage /> },
      { path: '/admin/orders/:id', element: <p>The live order page</p> },
    ],
    { initialEntries: [`/admin/orders/deleted/${id}${search}`] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        {...(onUrlUpdate === undefined ? {} : { onUrlUpdate })}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

function backend(
  detail: DeletedOrderDetailFixture = deletedOrderDetail(),
  options: Partial<Omit<DeletedOrdersOptions, 'list' | 'detail'>> = {},
) {
  return deletedOrdersBackend({ list: deletedOrderList([]), detail, ...options });
}

async function loaded(): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
}

describe('the page, read-only (ORD-06, D-24)', () => {
  it('shows the order number, status, subline and the Items rows from the deleted read', async () => {
    const calls = backend();
    renderPage();

    await loaded();
    expect(screen.getByText('In Production')).toBeVisible();
    expect(await screen.findByText(/Ordered Sep 28, 2026/)).toHaveTextContent(
      'Brgy. San Roque Ballers · Juan Dela Cruz · Ordered Sep 28, 2026',
    );
    const table = await screen.findByRole('table', { name: 'Order items' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(table).getByText('Jersey top, sublimated, names and numbers')).toBeVisible();
    expect(calls.reads).toEqual([order0148.id]);
  });

  it('shows the totals panel with Order Expenses and Estimated Profit, and the customer card and history', async () => {
    backend();
    renderPage();

    await loaded();
    const panel = screen.getByRole('region', { name: 'Totals' });
    expect(within(panel).getByText('Total').nextSibling).toHaveTextContent('₱21,327.50');
    expect(within(panel).getByText('Order Expenses').nextSibling).toHaveTextContent('₱6,065.00');
    expect(within(panel).getByText('Estimated Profit').nextSibling).toHaveTextContent('₱15,262.50');
    expect(within(screen.getByRole('region', { name: 'Customer' })).getByText('Juan Dela Cruz')).toBeVisible();
    expect(screen.getByText('Status history')).toBeVisible();
  });

  it('is read-only: no Change Status, Edit Details, Delete Order, Add button, row action, Record Refund or Edit link', async () => {
    const cleared = buildOrderDetail({
      ...creditOrder,
      refunds: [orderRefund('2026-10-08', 100, 'Part refund')],
    });
    backend(deletedOrderDetail(cleared));
    const user = userEvent.setup();
    renderPage({ id: cleared.id });

    await screen.findByRole('heading', { level: 1, name: cleared.number });
    const noWrites = (): void => {
      expect(screen.queryByRole('button', { name: /Change Status/ })).toBeNull();
      expect(screen.queryByRole('link', { name: /Edit/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Delete Order$/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
      expect(screen.queryByRole('button', { name: /^(Edit|Delete) / })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Record Refund' })).toBeNull();
    };
    noWrites();
    for (const tab of [/^Payments/, /^Discounts/, /^Expenses/, /^Refunds/]) {
      await user.click(screen.getByRole('tab', { name: tab }));
      noWrites();
    }
  });

  it('offers only Restore Order and Delete Order Permanently', async () => {
    backend();
    renderPage();

    await loaded();
    const banner = screen.getByText(/This order was deleted on/).closest('div')?.parentElement;
    if (banner === null || banner === undefined) throw new Error('No banner');
    expect(within(banner).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Restore Order',
      'Delete Order Permanently',
    ]);
  });

  it('has no axe violations', async () => {
    backend();
    const { container } = renderPage();

    await loaded();
    await expectNoAxeViolations(container);
  });
});

describe('the banner (D-57)', () => {
  it('says when the order was deleted, in Manila time, and by whom', async () => {
    backend();
    renderPage();

    await loaded();
    expect(screen.getByText('This order was deleted on Oct 12, 2026, 3:42 PM by Carmen Reyes.')).toBeVisible();
    expect(screen.getByText("It counts nowhere until it's restored.")).toBeVisible();
  });

  it('leaves the name out when no person deleted it', async () => {
    backend(deletedOrderDetail(order0148, { deletedBy: null }));
    renderPage();

    await loaded();
    expect(screen.getByText('This order was deleted on Oct 12, 2026, 3:42 PM.')).toBeVisible();
  });
});

describe('the back link and the tab', () => {
  it('reads Deleted Orders and goes to the deleted list', async () => {
    backend();
    const user = userEvent.setup();
    const { router } = renderPage();

    await loaded();
    const link = screen.getByRole('link', { name: 'Deleted Orders' });
    expect(link).toHaveAttribute('href', '/admin/orders/deleted');
    await user.click(link);
    expect(await screen.findByText('The deleted list')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/orders/deleted');
  });

  it('selects Payments for ?tab=payments and writes the tab to the URL when one is chosen', async () => {
    backend();
    const user = userEvent.setup();
    const updates: string[] = [];
    renderPage({ search: '?tab=payments', onUrlUpdate: (event) => updates.push(event.queryString) });

    expect(await screen.findByRole('tab', { name: /^Payments/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /^Expenses/ }));
    await waitFor(() => {
      expect(updates).toContain('?tab=expenses');
    });
  });
});

describe('Restore Order (D-23, D-57)', () => {
  it('sends one POST with an Idempotency-Key, goes to the live order and toasts Order restored', async () => {
    const calls = backend();
    const user = userEvent.setup();
    const { router } = renderPage();

    await loaded();
    await user.dblClick(screen.getByRole('button', { name: 'Restore Order' }));

    expect(await screen.findByText('The live order page')).toBeVisible();
    expect(router.state.location.pathname).toBe(`/admin/orders/${order0148.id}`);
    expect(await screen.findByText('Order restored')).toBeVisible();
    expect(calls.restores).toHaveLength(1);
    expect(calls.restores[0]?.id).toBe(order0148.id);
    expect(calls.restores[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('shows Restoring while the answer is on its way', async () => {
    let release: () => void = () => undefined;
    backend(deletedOrderDetail(), {
      restore: () =>
        new Promise<Response>((resolve) => {
          release = () => {
            resolve(new Response(null, { status: 204 }));
          };
        }),
    });
    const user = userEvent.setup();
    renderPage();

    await loaded();
    await user.click(screen.getByRole('button', { name: 'Restore Order' }));
    const pending = await screen.findByRole('button', { name: 'Restoring' });
    expect(pending).toHaveAttribute('aria-busy', 'true');

    release();
    expect(await screen.findByText('The live order page')).toBeVisible();
  });

  it('stays on the page and shows a danger toast when the restore fails', async () => {
    backend(deletedOrderDetail(), { restore: () => deletedProblem(500) });
    const user = userEvent.setup();
    const { router } = renderPage();

    await loaded();
    await user.click(screen.getByRole('button', { name: 'Restore Order' }));

    expect(await screen.findByText("Couldn't restore ORD-2026-0148")).toBeVisible();
    expect(router.state.location.pathname).toBe(`/admin/orders/deleted/${order0148.id}`);
  });
});

describe('Delete Order Permanently (07 D-28, D-57)', () => {
  it('opens the counts dialog, and the exact number deletes it and goes back to the deleted list', async () => {
    const calls = backend();
    const user = userEvent.setup();
    const { router } = renderPage();

    await loaded();
    await user.click(screen.getByRole('button', { name: 'Delete Order Permanently' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete ORD-2026-0148 permanently?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete Order Permanently' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), 'ORD-2026-0148');
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    await user.click(confirm);

    expect(await screen.findByText('The deleted list')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/orders/deleted');
    expect(await screen.findByText('Order permanently deleted')).toBeVisible();
    expect(calls.purges).toEqual([{ id: order0148.id, confirm: 'ORD-2026-0148', key: null }]);
  });
});
