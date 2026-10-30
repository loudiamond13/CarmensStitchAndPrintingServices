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
describe('Delete Item', () => {
  it('asks with the item name and the order number, then deletes with no key and no version', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: THREE,
      reply: () => HttpResponse.json(answer([TOP, POLO], 3350)),
    });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Delete item 2, Shorts, matching colorway' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete item "Shorts, matching colorway"?' });
    expect(
      within(dialog).getByText('This removes it from ORD-2026-0148 and updates the totals right away.'),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Delete Item' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]).toMatchObject({
      method: 'DELETE',
      path: `/orders/${THREE.id}/items/${SHORTS.id}`,
      body: null,
      key: null,
    });
  });

  it('applies the answer, toasts "Item deleted" with the balance, and focuses the next row\'s Edit', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE, reply: () => HttpResponse.json(answer([TOP, POLO], 3350)) });
    renderTab(THREE);
    await user.click(await screen.findByRole('button', { name: 'Delete item 2, Shorts, matching colorway' }));

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));

    expect(await screen.findByText('Item deleted')).toBeInTheDocument();
    expect(screen.getByText('Balance now ₱3,350.00.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Shorts, matching colorway/ })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Edit item 2, Coach polo' })).toHaveFocus();
  });

  it("focuses the previous row's Edit when the last row is deleted", async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE, reply: () => HttpResponse.json(answer([TOP, SHORTS], 3350)) });
    renderTab(THREE);
    await user.click(await screen.findByRole('button', { name: 'Delete item 3, Coach polo' }));

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Coach polo/ })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Edit item 2, Shorts, matching colorway' })).toHaveFocus();
  });

  it('focuses the tab heading when no row is left', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE, reply: () => HttpResponse.json(answer([], 3350)) });
    renderTab(THREE);
    await user.click(await screen.findByRole('button', { name: 'Delete item 1, Jersey top' }));

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Edit item / })).toBeNull();
    });
    expect(screen.getByRole('heading', { level: 3, name: 'Order items' })).toHaveFocus();
  });

  it('keeps the dialog open and shows the server sentence when the last item was already taken (orders.last-item)', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      detail: THREE,
      reply: () =>
        new HttpResponse(
          JSON.stringify({
            title: 'x',
            status: 422,
            code: 'orders.last-item',
            detail: 'An order needs at least one item. Add another item before removing this one.',
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    renderTab(THREE);
    await user.click(await screen.findByRole('button', { name: 'Delete item 2, Shorts, matching colorway' }));

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An order needs at least one item. Add another item before removing this one.',
    );
    expect(screen.getByRole('dialog', { name: 'Delete item "Shorts, matching colorway"?' })).toBeVisible();
  });

  it('closes with Cancel and sends nothing', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: THREE });
    renderTab(THREE);
    const remove = await screen.findByRole('button', { name: 'Delete item 2, Shorts, matching colorway' });
    await user.click(remove);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.writes).toEqual([]);
    expect(remove).toHaveFocus();
  });

  it('sends one request for a double click on Delete Item', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: THREE,
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(answer([TOP, POLO], 3350));
      },
    });
    renderTab(THREE);
    await user.click(await screen.findByRole('button', { name: 'Delete item 2, Shorts, matching colorway' }));

    await user.dblClick(screen.getByRole('button', { name: 'Delete Item' }));

    await screen.findByText('Item deleted');
    expect(backend.writes).toHaveLength(1);
  });
});

describe('the last item (D-48, UIC-49)', () => {
  it('shows no Delete and the note when one item is left, and Edit stays', async () => {
    const one = buildOrderDetail({ items: [TOP], totals: { ...order0148.totals, subtotal: 9750 } });
    useOrderHandlers({ detail: one });
    renderTab(one);

    await screen.findByRole('table', { name: 'Order items' });
    expect(screen.queryByRole('button', { name: /^Delete item / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit item 1, Jersey top' })).toBeVisible();
    expect(screen.getByText("An order needs at least one item, so the last one can't be deleted.")).toBeVisible();
  });

  it('shows the Delete actions and no note when more than one item is left', async () => {
    useOrderHandlers({ detail: THREE });
    renderTab(THREE);

    await screen.findByRole('table', { name: 'Order items' });
    expect(screen.queryByText(/the last one can't be deleted/)).toBeNull();
  });
});
