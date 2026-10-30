import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderItemsTab } from '@/modules/admin/components/OrderItemsTab';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { BASKETBALL_ID } from '@/test/orderListFixtures';
import {
  BASKETBALL_JERSEY,
  buildOrderDetail,
  completedOrder,
  order0148,
  orderItem,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Items tab actions (ORD-07, D-28, D-48; plan 08-14): Add, Edit and Delete on an active order, each answering the whole order,
// with the page showing the server's figures and the lists refreshed.

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

/** The tab as the order page draws it: it reads the order from the query, so a saved answer lands on it. */
function Page({ id, readOnly }: { id: string; readOnly?: boolean | undefined }) {
  const query = useOrderQuery(id);
  return query.data === undefined ? null : <OrderItemsTab order={query.data} readOnly={readOnly} />;
}

function renderTab(order: OrderDetailFixture = order0148, readOnly?: boolean): void {
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Page id={order.id} readOnly={readOnly} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** The order the server answers an add with: the current items plus one, and the figures it works out. */
function afterAdd(): OrderDetailFixture {
  const added = orderItem(BASKETBALL_JERSEY, 'Warm-up jacket', 12, 780, { id: '00000000-0000-4000-9100-0000000000aa' });
  return buildOrderDetail({
    items: [...order0148.items, added],
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, subtotal: 31810, discount: 1590.5, total: 30219.5, balance: 18219.5 },
  });
}

describe('Add Item', () => {
  it('shows a primary Add Item button in the tab head of an active order', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab();

    expect(await screen.findByRole('button', { name: 'Add Item' })).toBeVisible();
  });

  it('opens the Add Item window from the button', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: order0148 });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Item' }));

    expect(screen.getByRole('dialog', { name: 'Add Item' })).toBeVisible();
  });

  it("adds an item, shows the server's new rows and subtotal, and puts focus back on Add Item", async () => {
    const user = userEvent.setup();
    const answer = afterAdd();
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(answer) });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <Page id={order0148.id} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
    const add = await screen.findByRole('button', { name: 'Add Item' });
    await user.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Add Item' });
    await within(dialog).findByRole('option', { name: 'Basketball Jersey' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Product type/ }), BASKETBALL_ID);
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Warm-up jacket');
    await user.type(within(dialog).getByRole('textbox', { name: /^Quantity/ }), '12');
    await user.type(within(dialog).getByRole('textbox', { name: /^Unit price/ }), '780');

    await user.click(within(dialog).getByRole('button', { name: 'Save Item' }));

    const table = await screen.findByRole('table', { name: 'Order items' });
    await waitFor(() => {
      expect(within(table).getByText('Warm-up jacket')).toBeVisible();
    });
    expect(within(table).getByText('Items subtotal · 60 pcs')).toBeVisible();
    expect(within(table).getByText('₱31,810.00')).toBeVisible();
    expect(backend.writes).toHaveLength(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Item' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Add Item' })).toHaveFocus();
  });
});

describe('a locked or deleted view (D-15, D-24)', () => {
  it('shows no Add, Edit or Delete on a completed order', async () => {
    useOrderHandlers({ detail: completedOrder });
    renderTab(completedOrder);

    await screen.findByRole('table', { name: 'Order items' });
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('shows no Add, Edit or Delete when read only', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab(order0148, true);

    await screen.findByRole('table', { name: 'Order items' });
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });
});

// ---- Edit and Delete (plan 08-14 tasks 2 and 3) ----

const BASKETBALL_REF = { id: BASKETBALL_ID, name: 'Basketball Jersey', tone: 'accent', retired: false };
const TOP = orderItem(BASKETBALL_REF, 'Jersey top', 15, 650, { id: '00000000-0000-4000-9100-0000000000c1' });
const SHORTS = orderItem(BASKETBALL_REF, 'Shorts, matching colorway', 15, 300, {
  id: '00000000-0000-4000-9100-0000000000c2',
});
const POLO = orderItem(BASKETBALL_REF, 'Coach polo', 2, 550, { id: '00000000-0000-4000-9100-0000000000c3' });

/** Three items, 15,350.00 in all. */
const THREE = buildOrderDetail({
  items: [TOP, SHORTS, POLO],
  discounts: [],
  totals: { ...order0148.totals, subtotal: 15350, discount: 0, total: 15350, paid: 12000, balance: 3350 },
});

/** The order the server answers a change with. */
function answer(items: OrderDetailFixture['items'], balance: number): OrderDetailFixture {
  return buildOrderDetail({
    items,
    discounts: [],
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, subtotal: 15350, discount: 0, total: 15350, paid: 12000, balance },
  });
}

describe('row actions (D-54a, UIC-54)', () => {
  it('names each row action by its row, with a matching title', async () => {
    useOrderHandlers({ detail: THREE });
    renderTab(THREE);

    const edit = await screen.findByRole('button', { name: 'Edit item 2, Shorts, matching colorway' });
    const remove = screen.getByRole('button', { name: 'Delete item 2, Shorts, matching colorway' });
    expect(edit).toHaveAttribute('title', 'Edit item 2, Shorts, matching colorway');
    expect(remove).toHaveAttribute('title', 'Delete item 2, Shorts, matching colorway');
    expect(screen.getAllByRole('button', { name: /^Edit item / })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^Delete item / })).toHaveLength(3);
  });
});

describe('Edit Item', () => {
  it("opens the window with the row's values, saves, shows the server's figures and puts focus back on the row's Edit", async () => {
    const user = userEvent.setup();
    const changed = orderItem(BASKETBALL_REF, 'Shorts, matching colorway', 20, 300, { id: SHORTS.id });
    const backend = useOrderHandlers({
      detail: THREE,
      reply: () => HttpResponse.json(answer([TOP, changed, POLO], 6350)),
    });
    renderTab(THREE);
    const edit = await screen.findByRole('button', { name: 'Edit item 2, Shorts, matching colorway' });

    await user.click(edit);

    const dialog = screen.getByRole('dialog', { name: 'Edit Item' });
    await within(dialog).findByRole('option', { name: 'Basketball Jersey' });
    expect(within(dialog).getByRole('textbox', { name: /^Description/ })).toHaveValue('Shorts, matching colorway');
    await user.clear(within(dialog).getByRole('textbox', { name: /^Quantity/ }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Quantity/ }), '20');
    await user.click(within(dialog).getByRole('button', { name: 'Save Item' }));

    const table = await screen.findByRole('table', { name: 'Order items' });
    await waitFor(() => {
      expect(within(table).getByText('Items subtotal · 37 pcs')).toBeVisible();
    });
    expect(backend.writes[0]?.method).toBe('PUT');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Item' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Edit item 2, Shorts, matching colorway' })).toHaveFocus();
  });

  it('puts focus back on the row Edit after Discard Changes too', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Edit item 3, Coach polo' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Item' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), ' x');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Edit item 3, Coach polo' })).toHaveFocus();
  });
});
