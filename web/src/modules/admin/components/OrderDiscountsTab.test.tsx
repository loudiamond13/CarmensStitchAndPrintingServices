import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderDiscountsTab } from '@/modules/admin/components/OrderDiscountsTab';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  order0148,
  orderDiscount,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { inStrictMode } from '@/test/strictMode';

// The Discounts tab actions (ORD-07, D-15, D-24, D-54a, 07 D-12; plan 08-17): Add, Edit and Delete on an active order, each answering the
// whole order, with the page showing the server's figures.

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
  return query.data === undefined ? null : <OrderDiscountsTab order={query.data} readOnly={readOnly} />;
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

const ADDED_ID = '00000000-0000-4000-9400-0000000000aa';

/** The order the server answers an add with: a second discount and the figures it works out. */
function afterAdd(): OrderDetailFixture {
  const added = orderDiscount('fixed', 500, 'Club discount', 500, { id: ADDED_ID });
  return buildOrderDetail({
    discounts: [...order0148.discounts, added],
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, discount: 1622.5, total: 20827.5, balance: 8827.5 },
  });
}

describe('Add Discount', () => {
  it('shows a primary Add Discount button in the tab head of an active order', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab();

    expect(await screen.findByRole('button', { name: 'Add Discount' })).toBeVisible();
  });

  it('opens the Add Discount window from the button', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: order0148 });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Discount' }));

    expect(screen.getByRole('dialog', { name: 'Add Discount' })).toBeInTheDocument();
  });

  it("adds a discount, shows the server's new rows and total discount, and puts focus back on Add Discount", async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(afterAdd()) });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Discount' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Discount' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Club discount');
    await user.type(within(dialog).getByRole('textbox', { name: /^Value/ }), '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save Discount' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Discount' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByText('Club discount')).toBeInTheDocument();
    expect(screen.getAllByText('−₱1,622.50').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Discount' })).toHaveFocus();
    });
  });
});

describe('locked and deleted views (D-15, D-24)', () => {
  it('shows no discount action on a completed order', async () => {
    useOrderHandlers({ detail: completedOrder });
    renderTab(completedOrder);

    await screen.findByRole('heading', { level: 3, name: 'Discounts' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) discount/i })).toBeNull();
  });

  it('shows no discount action on a cancelled order', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderTab(cancelledOrderWithRefunds);

    await screen.findByRole('heading', { level: 3, name: 'Discounts' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) discount/i })).toBeNull();
  });

  it('shows no Add, Edit or Delete control when readOnly (the deleted view)', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab(order0148, true);

    await screen.findByRole('table', { name: 'Discounts' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) discount/i })).toBeNull();
  });
});

// ---- Edit, Delete and the credit case (D-15, D-54a, 07 D-12, D-05) ----

const LEAGUE_ID = '00000000-0000-4000-9400-0000000000b1';
const CLUB_ID = '00000000-0000-4000-9400-0000000000b2';
const LEAGUE = orderDiscount('percentage', 5, 'Barangay league discount', 1122.5, { id: LEAGUE_ID });
const CLUB = orderDiscount('fixed', 500, 'Club discount', 500, { id: CLUB_ID });
const TWO = buildOrderDetail({
  discounts: [LEAGUE, CLUB],
  totals: { ...order0148.totals, discount: 1622.5, total: 20827.5, balance: 8827.5 },
});

/** The order the server answers a delete with: the given discounts and the figures it works out. */
function afterRemoval(discounts: OrderDetailFixture['discounts'], discount: number): OrderDetailFixture {
  return buildOrderDetail({
    discounts,
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, discount, total: 22450 - discount, balance: 22450 - discount - 12000 },
  });
}

function problemResponse(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('the Amount column (D-94)', () => {
  // 5% of 22,450.00 is 1,122.50, so a server amount of 1,000.00 can only come from the answer, never from the browser.
  const SERVER_AMOUNT = 1000;
  const odd = (overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture =>
    buildOrderDetail({
      discounts: [orderDiscount('percentage', 5, 'Barangay league discount', SERVER_AMOUNT, { id: LEAGUE_ID })],
      totals: { ...order0148.totals, discount: SERVER_AMOUNT, total: 21450, balance: 9450 },
      ...overrides,
    });

  async function leagueRow(): Promise<HTMLElement> {
    const rows = within(await screen.findByRole('table', { name: 'Discounts' })).getAllByRole('row');
    const row = rows.find((candidate) => within(candidate).queryByText('Barangay league discount') !== null);
    if (row === undefined) throw new Error('No league row');
    return row;
  }

  it('shows the server amount in the row, not an amount the browser works out', async () => {
    const order = odd();
    useOrderHandlers({ detail: order });
    renderTab(order);

    const row = await leagueRow();
    expect(within(row).getByText('−₱1,000.00')).toBeVisible();
    expect(within(row).queryByText('−₱1,122.50')).not.toBeInTheDocument();
  });

  it('shows the server amount in the read-only deleted view', async () => {
    const order = odd();
    useOrderHandlers({ detail: order });
    renderTab(order, true);

    expect(within(await leagueRow()).getByText('−₱1,000.00')).toBeVisible();
  });

  it('shows the server amount on a locked order', async () => {
    const order = odd({ status: 'completed' });
    useOrderHandlers({ detail: order });
    renderTab(order);

    expect(within(await leagueRow()).getByText('−₱1,000.00')).toBeVisible();
  });

  it('keeps the footer at the server total discount', async () => {
    const order = odd({ totals: { ...order0148.totals, discount: 1000.5, total: 21449.5, balance: 9449.5 } });
    useOrderHandlers({ detail: order });
    renderTab(order);

    await leagueRow();
    expect(within(screen.getByRole('table', { name: 'Discounts' })).getAllByText('−₱1,000.50').length).toBeGreaterThan(0);
  });
});

describe('row actions (D-54a)', () => {
  it('names each row action by its reason, with a matching title', async () => {
    useOrderHandlers({ detail: TWO });
    renderTab(TWO);

    const edit = await screen.findByRole('button', { name: 'Edit discount, Club discount' });
    const remove = screen.getByRole('button', { name: 'Delete discount, Club discount' });
    expect(edit).toHaveAttribute('title', 'Edit discount, Club discount');
    expect(remove).toHaveAttribute('title', 'Delete discount, Club discount');
    expect(screen.getByRole('button', { name: 'Edit discount, Barangay league discount' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete discount, Barangay league discount' })).toBeInTheDocument();
  });

  it('shows the type badge and the value of each row beside its actions', async () => {
    useOrderHandlers({ detail: TWO });
    renderTab(TWO);

    const rows = within(await screen.findByRole('table', { name: 'Discounts' })).getAllByRole('row');
    const club = rows.find((row) => within(row).queryByText('Club discount') !== null);
    if (club === undefined) throw new Error('No Club discount row');
    expect(within(club).getByText('Fixed amount')).toBeVisible();
    expect(within(club).getByText('₱500.00')).toBeVisible();
    const league = rows.find((row) => within(row).queryByText('Barangay league discount') !== null);
    if (league === undefined) throw new Error('No league row');
    expect(within(league).getByText('Percentage')).toBeVisible();
    expect(within(league).getByText('5%')).toBeVisible();
  });
});

describe('Edit Discount', () => {
  it('opens the window with the row values and puts focus back on that row Edit after a save', async () => {
    const user = userEvent.setup();
    const answer = buildOrderDetail({
      discounts: [LEAGUE, orderDiscount('fixed', 750, 'Club discount', 750, { id: CLUB_ID })],
      version: 'AAAAAAAAB9F=',
      totals: { ...order0148.totals, discount: 1872.5, total: 20577.5, balance: 8577.5 },
    });
    const backend = useOrderHandlers({ detail: TWO, reply: () => HttpResponse.json(answer) });
    renderTab(TWO);

    await user.click(await screen.findByRole('button', { name: 'Edit discount, Club discount' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Discount' });
    expect(within(dialog).getByRole('textbox', { name: /^Reason/ })).toHaveValue('Club discount');
    const value = within(dialog).getByRole('textbox', { name: /^Value/ });
    expect(value).toHaveValue('500.00');
    await user.clear(value);
    await user.type(value, '750');
    await user.click(within(dialog).getByRole('button', { name: 'Save Discount' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Discount' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.method).toBe('PUT');
    expect(screen.getByText('₱750.00')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit discount, Club discount' })).toHaveFocus();
    });
  });
});

describe('Delete Discount', () => {
  it('asks with the reason and the order number, then deletes with no key and no version', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: TWO,
      reply: () => HttpResponse.json(afterRemoval([LEAGUE], 1122.5)),
    });
    renderTab(TWO);

    await user.click(await screen.findByRole('button', { name: 'Delete discount, Club discount' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete discount "Club discount"?' });
    expect(dialog).toHaveTextContent('This removes it from ORD-2026-0148 and updates the totals right away.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Discount' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete discount "Club discount"?' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]).toMatchObject({
      method: 'DELETE',
      path: `/orders/${TWO.id}/discounts/${CLUB_ID}`,
      key: null,
      body: null,
    });
  });

  it('applies the answer, toasts "Discount deleted" with the balance, and focuses the previous row Edit', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: TWO, reply: () => HttpResponse.json(afterRemoval([LEAGUE], 1122.5)) });
    renderTab(TWO);

    await user.click(await screen.findByRole('button', { name: 'Delete discount, Club discount' }));
    await user.click(screen.getByRole('button', { name: 'Delete Discount' }));

    expect(await screen.findByText('Discount deleted')).toBeInTheDocument();
    expect(screen.getByText('Balance now ₱9,327.50.')).toBeInTheDocument();
    expect(screen.queryByText('Club discount')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit discount, Barangay league discount' })).toHaveFocus();
    });
  });

  it('focuses the tab heading when no discount is left', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(afterRemoval([], 0)) });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Delete discount, Barangay league discount' }));
    await user.click(screen.getByRole('button', { name: 'Delete Discount' }));

    expect(await screen.findByText('No discounts yet.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Discounts' })).toHaveFocus();
    });
  });

  it('says "This discount was removed." when the discount is already gone (404)', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: TWO, reply: () => problemResponse(404, 'orders.discount-not-found') });
    renderTab(TWO);

    await user.click(await screen.findByRole('button', { name: 'Delete discount, Club discount' }));
    await user.click(screen.getByRole('button', { name: 'Delete Discount' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This discount was removed.');
    expect(screen.getByRole('dialog', { name: 'Delete discount "Club discount"?' })).toBeInTheDocument();
  });

  it('closes with Cancel, sends nothing and returns focus to that row Delete', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: TWO });
    renderTab(TWO);
    const remove = await screen.findByRole('button', { name: 'Delete discount, Club discount' });

    await user.click(remove);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.writes).toEqual([]);
    expect(remove).toHaveFocus();
  });

  it('sends one request for a double click on Delete Discount', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: TWO,
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(afterRemoval([LEAGUE], 1122.5));
      },
    });
    renderTab(TWO);
    await user.click(await screen.findByRole('button', { name: 'Delete discount, Club discount' }));

    await user.dblClick(screen.getByRole('button', { name: 'Delete Discount' }));

    await screen.findByText('Discount deleted');
    expect(backend.writes).toHaveLength(1);
  });
});

describe('a discount that turns a paid order into a credit (07 D-12, D-05)', () => {
  const paidUp = buildOrderDetail({
    discounts: [],
    totals: { ...order0148.totals, discount: 0, total: 22450, paid: 22450, balance: 0, fullyPaid: true },
  });

  it('toasts "Customer credit now ₱X." when the answer has a positive customer credit', async () => {
    const user = userEvent.setup();
    const answer = buildOrderDetail({
      discounts: [orderDiscount('fixed', 500, 'Goodwill', 500, { id: ADDED_ID })],
      version: 'AAAAAAAAB9F=',
      totals: {
        ...order0148.totals,
        discount: 500,
        total: 21950,
        paid: 22450,
        balance: 0,
        customerCredit: 500,
        fullyPaid: false,
      },
    });
    useOrderHandlers({ detail: paidUp, reply: () => HttpResponse.json(answer) });
    renderTab(paidUp);

    await user.click(await screen.findByRole('button', { name: 'Add Discount' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Discount' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Goodwill');
    await user.type(within(dialog).getByRole('textbox', { name: /^Value/ }), '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save Discount' }));

    expect(await screen.findByText('Discount added')).toBeInTheDocument();
    expect(screen.getByText('Customer credit now ₱500.00.')).toBeInTheDocument();
  });

  it('allows the add in the browser: the discount cap looks at the items total, not at what is paid', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: paidUp, reply: () => HttpResponse.json(afterAdd()) });
    renderTab(paidUp);

    await user.click(await screen.findByRole('button', { name: 'Add Discount' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Discount' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Goodwill');
    await user.type(within(dialog).getByRole('textbox', { name: /^Value/ }), '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save Discount' }));

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
  });
});

describe('under StrictMode', () => {
  it('draws the tab with the same rows, whether the render is cached or fresh', async () => {
    useOrderHandlers({ detail: order0148 });
    await inStrictMode(async () => {
      renderTab();
      expect(await screen.findByRole('table', { name: 'Discounts' })).toBeVisible();
    });
  });
});
