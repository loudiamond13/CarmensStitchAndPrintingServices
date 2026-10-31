import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { orderKey, useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  CASH,
  order0148,
  orderPayment,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { listBackend, PAYMENT_METHODS } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Payments tab actions (ORD-07, D-15, D-24, D-28, D-48; plan 08-16): Add, Edit and Delete on an active order that still owes
// money, each answering the whole order, with the page showing the server's figures.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  listBackend('payment-methods', PAYMENT_METHODS);
  staffBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

/** The tab as the order page draws it: it reads the order from the query, so a saved answer lands on it. */
function Page({ id, readOnly }: { id: string; readOnly?: boolean | undefined }) {
  const query = useOrderQuery(id);
  return query.data === undefined ? null : <OrderPaymentsTab order={query.data} readOnly={readOnly} />;
}

function renderTab(order: OrderDetailFixture = order0148, readOnly?: boolean, heldAge = 0): void {
  // The page already holds the order, read heldAge ms ago; over a second, a failed check reads it again (D-95).
  if (heldAge > 0) {
    queryClient.setQueryData(orderKey(order.id), order, { updatedAt: Date.now() - heldAge });
  }
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

/** The order the server answers an add with: one more payment and the figures it works out. */
function afterAdd(): OrderDetailFixture {
  const added = orderPayment('2026-10-08', CASH, 2000, { id: '00000000-0000-4000-9200-0000000000aa' });
  return buildOrderDetail({
    payments: [...order0148.payments, added],
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, paid: 14000, balance: 7327.5 },
  });
}

describe('Add Payment', () => {
  it('shows a primary Add Payment button in the tab head of an active order that owes money', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab();

    expect(await screen.findByRole('button', { name: 'Add Payment' })).toBeVisible();
  });

  it('opens the Add Payment window from the button', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: order0148 });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Payment' }));

    expect(screen.getByRole('dialog', { name: 'Add Payment' })).toBeInTheDocument();
  });

  it("adds a payment, shows the server's new rows and total paid, and puts focus back on Add Payment", async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(afterAdd()) });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Payment' });
    await within(dialog).findByRole('option', { name: 'Cash' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '2000');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Method/ }), 'Cash');
    await user.click(within(dialog).getByRole('button', { name: 'Save Payment' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Payment' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByText('₱14,000.00')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Payment' })).toHaveFocus();
    });
  });
});

// ---- Edit, Delete, nothing owed and locked views (D-15, D-24, D-48, D-54a) ----

const GCASH_PAYMENT = order0148.payments[0];
const CASH_PAYMENT = order0148.payments[1];

/** The order the server answers a delete with: the given payments and the figures it works out. */
function afterRemoval(payments: OrderDetailFixture['payments'], paid: number, balance: number): OrderDetailFixture {
  return buildOrderDetail({
    payments,
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, paid, balance },
  });
}

describe('row actions (D-54a)', () => {
  it('names each row action by its amount and date, with a matching title', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab();

    const edit = await screen.findByRole('button', { name: 'Edit payment of ₱2,000.00, Oct 3, 2026' });
    const remove = screen.getByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' });
    expect(edit).toHaveAttribute('title', 'Edit payment of ₱2,000.00, Oct 3, 2026');
    expect(remove).toHaveAttribute('title', 'Delete payment of ₱2,000.00, Oct 3, 2026');
    expect(screen.getByRole('button', { name: 'Edit payment of ₱10,000.00, Sep 28, 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete payment of ₱10,000.00, Sep 28, 2026' })).toBeInTheDocument();
  });
});

describe('Edit Payment', () => {
  it('opens the window with the row values and puts focus back on that row Edit after a save', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: order0148,
      reply: () => HttpResponse.json(afterRemoval(order0148.payments, 12500, 8827.5)),
    });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Edit payment of ₱2,000.00, Oct 3, 2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Payment' });
    const amount = within(dialog).getByRole('textbox', { name: /^Amount/ });
    expect(amount).toHaveValue('2000.00');
    await within(dialog).findByRole('option', { name: 'Cash' });
    await user.clear(amount);
    await user.type(amount, '2500');
    await user.click(within(dialog).getByRole('button', { name: 'Save Payment' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Payment' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]).toMatchObject({
      method: 'PUT',
      path: `/orders/${order0148.id}/payments/${CASH_PAYMENT?.id ?? ''}`,
      key: null,
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit payment of ₱2,000.00, Oct 3, 2026' })).toHaveFocus();
    });
  });
});

describe('Delete Payment', () => {
  it('asks with the amount and the order number, then deletes with no key and no version', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: order0148,
      reply: () => HttpResponse.json(afterRemoval(GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT], 10000, 11327.5)),
    });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete payment of ₱2,000.00?' });
    expect(
      within(dialog).getByText('This removes it from ORD-2026-0148 and updates the totals right away.'),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Delete Payment' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]).toMatchObject({
      method: 'DELETE',
      path: `/orders/${order0148.id}/payments/${CASH_PAYMENT?.id ?? ''}`,
      body: null,
      key: null,
    });
  });

  it('applies the answer, toasts "Payment deleted" with the balance, and focuses the previous row Edit', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      detail: order0148,
      reply: () => HttpResponse.json(afterRemoval(GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT], 10000, 11327.5)),
    });
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.click(screen.getByRole('button', { name: 'Delete Payment' }));

    expect(await screen.findByText('Payment deleted')).toBeInTheDocument();
    expect(screen.getByText('Balance now ₱11,327.50.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /₱2,000\.00, Oct 3, 2026/ })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Edit payment of ₱10,000.00, Sep 28, 2026' })).toHaveFocus();
  });

  it('focuses the tab heading when no payment is left', async () => {
    const user = userEvent.setup();
    const one = buildOrderDetail({
      payments: CASH_PAYMENT === undefined ? [] : [CASH_PAYMENT],
      totals: { ...order0148.totals, paid: 2000, balance: 19327.5 },
    });
    useOrderHandlers({ detail: one, reply: () => HttpResponse.json(afterRemoval([], 0, 21327.5)) });
    renderTab(one);
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.click(screen.getByRole('button', { name: 'Delete Payment' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Edit payment / })).toBeNull();
    });
    expect(screen.getByRole('heading', { level: 3, name: 'Payments' })).toHaveFocus();
  });

  it("shows the server's sentence and sends nothing when the payments left would be below the refunds", async () => {
    const user = userEvent.setup();
    const refunded = buildOrderDetail({ totals: { ...order0148.totals, paid: 12000, refunded: 11000 } });
    const backend = useOrderHandlers({ detail: refunded });
    renderTab(refunded);
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.click(screen.getByRole('button', { name: 'Delete Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The refunds would be more than the payments. Lower or remove a refund first.',
    );
    expect(screen.getByRole('dialog', { name: 'Delete payment of ₱2,000.00?' })).toBeVisible();
    expect(backend.writes).toEqual([]);
  });

  it('still lets a payment go when the payments left cover the refunds exactly', async () => {
    const user = userEvent.setup();
    const refunded = buildOrderDetail({ totals: { ...order0148.totals, paid: 12000, refunded: 10000 } });
    const backend = useOrderHandlers({
      detail: refunded,
      reply: () => HttpResponse.json(afterRemoval(GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT], 10000, 11327.5)),
    });
    renderTab(refunded);
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.click(screen.getByRole('button', { name: 'Delete Payment' }));

    await screen.findByText('Payment deleted');
    expect(backend.writes).toHaveLength(1);
  });

  describe('reads the order once more before it refuses (D-95)', () => {
    const HELD_FOR = 5_000;
    const BELOW_REFUNDS = 'The refunds would be more than the payments. Lower or remove a refund first.';
    const held = buildOrderDetail({ totals: { ...order0148.totals, paid: 12000, refunded: 11000 } });
    const deleteCash = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
      await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));
      await user.click(screen.getByRole('button', { name: 'Delete Payment' }));
    };

    it('sends the DELETE when the current figures allow it, after one read', async () => {
      const current = buildOrderDetail({
        totals: { ...order0148.totals, paid: 12000, refunded: 1000 },
        version: 'AAAAAAAAB9F=',
      });
      const backend = useOrderHandlers({
        detail: current,
        reply: () =>
          HttpResponse.json(afterRemoval(GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT], 10000, 11327.5)),
      });
      renderTab(held, undefined, HELD_FOR);

      await deleteCash(userEvent.setup());

      expect(await screen.findByText('Payment deleted')).toBeInTheDocument();
      expect(backend.reads).toEqual([order0148.id]);
      expect(backend.writes).toHaveLength(1);
      expect(backend.writes[0]).toMatchObject({ method: 'DELETE' });
    });

    it('shows the below-refunds sentence and sends nothing when the read gives the same figures', async () => {
      const backend = useOrderHandlers({ detail: held });
      renderTab(held, undefined, HELD_FOR);

      await deleteCash(userEvent.setup());

      expect(await screen.findByRole('alert')).toHaveTextContent(BELOW_REFUNDS);
      expect(backend.reads).toEqual([order0148.id]);
      expect(backend.writes).toEqual([]);
    });

    it('shows the below-refunds sentence and sends nothing when the read fails', async () => {
      const backend = useOrderHandlers({ detail: () => new HttpResponse(null, { status: 500 }) });
      renderTab(held, undefined, HELD_FOR);

      await deleteCash(userEvent.setup());

      expect(await screen.findByRole('alert')).toHaveTextContent(BELOW_REFUNDS);
      expect(backend.reads).toEqual([order0148.id]);
      expect(backend.writes).toEqual([]);
    });

    it('sends the DELETE when the current order no longer holds the payment, and the server 404 shows the removed line', async () => {
      const current = buildOrderDetail({
        payments: GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT],
        totals: { ...order0148.totals, paid: 10000, refunded: 11000 },
        version: 'AAAAAAAAB9F=',
      });
      const backend = useOrderHandlers({
        detail: current,
        reply: () =>
          new HttpResponse(JSON.stringify({ title: 'x', status: 404, code: 'orders.payment-not-found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          }),
      });
      renderTab(held, undefined, HELD_FOR);

      await deleteCash(userEvent.setup());

      expect(await screen.findByRole('alert')).toHaveTextContent('This payment was removed.');
      expect(backend.writes).toHaveLength(1);
    });

    it('sends no read when the held figures already allow the delete', async () => {
      const allowed = buildOrderDetail({ totals: { ...order0148.totals, paid: 12000, refunded: 10000 } });
      const backend = useOrderHandlers({
        detail: allowed,
        reply: () =>
          HttpResponse.json(afterRemoval(GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT], 10000, 11327.5)),
      });
      renderTab(allowed, undefined, HELD_FOR);

      await deleteCash(userEvent.setup());

      await screen.findByText('Payment deleted');
      expect(backend.reads).toEqual([]);
    });
  });

  it('keeps the dialog open and shows the server sentence for a 422 orders.payment-below-refunds', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      detail: order0148,
      reply: () =>
        new HttpResponse(
          JSON.stringify({
            title: 'x',
            status: 422,
            code: 'orders.payment-below-refunds',
            detail: 'The refunds would be more than the payments. Lower or remove a refund first.',
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.click(screen.getByRole('button', { name: 'Delete Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The refunds would be more than the payments. Lower or remove a refund first.',
    );
    expect(screen.getByRole('dialog', { name: 'Delete payment of ₱2,000.00?' })).toBeVisible();
  });

  it('says "This payment was removed." when the payment is already gone (404)', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      detail: order0148,
      reply: () =>
        new HttpResponse(JSON.stringify({ title: 'x', status: 404, code: 'orders.payment-not-found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    });
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.click(screen.getByRole('button', { name: 'Delete Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This payment was removed.');
  });

  it('closes with Cancel, sends nothing and returns focus to that row Delete', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: order0148 });
    renderTab();
    const remove = await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' });
    await user.click(remove);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.writes).toEqual([]);
    expect(remove).toHaveFocus();
  });

  it('sends one request for a double click on Delete Payment', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: order0148,
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(afterRemoval(GCASH_PAYMENT === undefined ? [] : [GCASH_PAYMENT], 10000, 11327.5));
      },
    });
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Delete payment of ₱2,000.00, Oct 3, 2026' }));

    await user.dblClick(screen.getByRole('button', { name: 'Delete Payment' }));

    await screen.findByText('Payment deleted');
    expect(backend.writes).toHaveLength(1);
  });
});

describe('Nothing is owed (D-48, UIC-50)', () => {
  const paidUp = buildOrderDetail({
    totals: { ...order0148.totals, paid: 21327.5, balance: 0, fullyPaid: true },
  });

  it('hides Add Payment and reads "Nothing is owed on this order." in the caption', async () => {
    useOrderHandlers({ detail: paidUp });
    renderTab(paidUp);

    expect(await screen.findByText(/Nothing is owed on this order\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Payment' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit payment of ₱2,000.00, Oct 3, 2026' })).toBeInTheDocument();
  });

  it('takes Add Payment away when a save settles the order, and moves focus to the tab heading', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      detail: order0148,
      reply: () =>
        HttpResponse.json(
          buildOrderDetail({
            version: 'AAAAAAAAB9F=',
            totals: { ...order0148.totals, paid: 21327.5, balance: 0, fullyPaid: true },
          }),
        ),
    });
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Add Payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Payment' });
    await within(dialog).findByRole('option', { name: 'Cash' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '9327.50');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Method/ }), 'Cash');
    await user.click(within(dialog).getByRole('button', { name: 'Save Payment' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add Payment' })).toBeNull();
    });
    expect(screen.getByText(/Nothing is owed on this order\./)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Payments' })).toHaveFocus();
    });
  });
});

describe('locked and deleted views (D-15, D-24)', () => {
  it('shows no payment action on a completed order', async () => {
    useOrderHandlers({ detail: completedOrder });
    renderTab(completedOrder);

    await screen.findByRole('table', { name: 'Payments' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) payment/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Payment' })).toBeNull();
  });

  it('shows no payment action on a cancelled order', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderTab(cancelledOrderWithRefunds);

    await screen.findByRole('table', { name: 'Payments' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) payment/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Payment' })).toBeNull();
  });

  it('shows no Add, Edit or Delete control when readOnly (the deleted view)', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab(order0148, true);

    await screen.findByRole('table', { name: 'Payments' });
    expect(screen.queryByRole('button', { name: 'Add Payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Edit|Delete) payment/ })).toBeNull();
  });
});
