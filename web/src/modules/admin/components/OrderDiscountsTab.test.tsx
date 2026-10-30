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
  const added = orderDiscount('fixed', 500, 'Club discount', { id: ADDED_ID });
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
