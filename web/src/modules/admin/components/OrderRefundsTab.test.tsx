import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderRefundsTab } from '@/modules/admin/components/OrderRefundsTab';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  CASH,
  completedOrder,
  creditOrder,
  orderPayment,
  orderProblem,
  orderRefund,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Refunds tab actions (ORD-18, D-13, D-24, D-54a, 07 D-09, 07 D-35; plan 08-21): Add, Edit and Delete on a Cancelled order or an
// order with a customer credit, each answering the whole order, with the cap from the server's figures.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  staffBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

/** The tab as the order page draws it: it reads the order from the query, so a saved answer lands on it. */
function Page({ id, readOnly }: { id: string; readOnly?: boolean | undefined }) {
  const query = useOrderQuery(id);
  return query.data === undefined ? null : <OrderRefundsTab order={query.data} readOnly={readOnly} />;
}

function renderTab(order: OrderDetailFixture, readOnly?: boolean): void {
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

const FIRST_ID = '00000000-0000-4000-9500-0000000000c1';
const SECOND_ID = '00000000-0000-4000-9500-0000000000c2';
const FIRST = orderRefund('2026-10-05', 500, 'Customer changed the order', { id: FIRST_ID });
const SECOND = orderRefund('2026-10-06', 300, 'Wrong size', { id: SECOND_ID });

/** A Cancelled order with 12,000.00 paid and 500.00 handed back: 11,500.00 can still be refunded. */
const CANCELLED = buildOrderDetail({
  ...cancelledOrderWithRefunds,
  payments: [orderPayment('2026-09-08', CASH, 12000)],
  refunds: [FIRST],
  totals: { ...cancelledOrderWithRefunds.totals, paid: 12000, refunded: 500, balance: 0 },
});

/** The same order with everything that was paid already handed back. */
const ALL_REFUNDED = buildOrderDetail({
  ...CANCELLED,
  refunds: [orderRefund('2026-10-05', 12000, 'Order cancelled', { id: FIRST_ID })],
  totals: { ...CANCELLED.totals, refunded: 12000 },
});

/** The order the server answers an add of 300.00 with. */
function afterAdd(): OrderDetailFixture {
  return buildOrderDetail({
    ...CANCELLED,
    refunds: [FIRST, SECOND],
    version: 'AAAAAAAAB9F=',
    totals: { ...CANCELLED.totals, refunded: 800 },
  });
}

describe('Add Refund', () => {
  it('shows a primary Add Refund in the head of a cancelled order and names the cap in the caption', async () => {
    useOrderHandlers({ detail: CANCELLED });
    renderTab(CANCELLED);

    expect(await screen.findByRole('button', { name: 'Add Refund' })).toBeVisible();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'P' &&
          node.textContent === 'Money handed back to the customer. You can refund up to ₱11,500.00.',
      ),
    ).toBeVisible();
  });

  it('shows Add Refund on an order with a customer credit and caps it at the credit', async () => {
    useOrderHandlers({ detail: creditOrder });
    renderTab(creditOrder);

    expect(await screen.findByRole('button', { name: 'Add Refund' })).toBeVisible();
    expect(screen.getByText('₱1,000.00')).toBeVisible();
  });

  it('opens the Add Refund window with nothing filled in, and refuses more than was paid and not yet refunded', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: CANCELLED });
    renderTab(CANCELLED);

    await user.click(await screen.findByRole('button', { name: 'Add Refund' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Refund' });
    expect(within(dialog).getByRole('textbox', { name: /^Amount/ })).toHaveValue('');
    await within(dialog).findByRole('option', { name: 'Paolo Garcia' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '11500.01');
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Too much');
    await user.click(within(dialog).getByRole('button', { name: 'Save Refund' }));

    expect(
      await within(dialog).findByText('This is more than was paid and not yet refunded. Enter ₱11,500.00 or less.'),
    ).toBeVisible();
    expect(backend.writes).toEqual([]);
  });

  it("adds a refund, shows the server's rows and Total refunded, and puts focus back on Add Refund", async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: CANCELLED, reply: () => HttpResponse.json(afterAdd()) });
    renderTab(CANCELLED);

    await user.click(await screen.findByRole('button', { name: 'Add Refund' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Refund' });
    await within(dialog).findByRole('option', { name: 'Paolo Garcia' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '300');
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Wrong size');
    await user.click(within(dialog).getByRole('button', { name: 'Save Refund' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Refund' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByText('Wrong size')).toBeVisible();
    expect(screen.getByText('₱800.00')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Refund' })).toHaveFocus();
    });
  });

  it('hides Add Refund and leaves the cap out of the caption when everything paid is handed back (UIC-48)', async () => {
    useOrderHandlers({ detail: ALL_REFUNDED });
    renderTab(ALL_REFUNDED);

    await screen.findByRole('heading', { level: 3, name: 'Refunds' });
    expect(screen.queryByRole('button', { name: 'Add Refund' })).toBeNull();
    expect(screen.getByText('Money handed back to the customer.')).toBeVisible();
    expect(screen.queryByText(/You can refund up to/)).toBeNull();
  });

  it('takes Add Refund away when a save hands back the rest, and focus goes to the tab heading', async () => {
    const user = userEvent.setup();
    const settled = buildOrderDetail({
      ...CANCELLED,
      refunds: [FIRST, orderRefund('2026-10-06', 11500, 'Rest', { id: SECOND_ID })],
      version: 'AAAAAAAAB9F=',
      totals: { ...CANCELLED.totals, refunded: 12000 },
    });
    useOrderHandlers({ detail: CANCELLED, reply: () => HttpResponse.json(settled) });
    renderTab(CANCELLED);

    await user.click(await screen.findByRole('button', { name: 'Add Refund' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Refund' });
    await within(dialog).findByRole('option', { name: 'Paolo Garcia' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '11500');
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Rest');
    await user.click(within(dialog).getByRole('button', { name: 'Save Refund' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add Refund' })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Refunds' })).toHaveFocus();
    });
  });
});

describe('row actions (D-54a, 07 D-35)', () => {
  it('shows the row actions on a cancelled order, named by amount and date, with a matching title', async () => {
    useOrderHandlers({ detail: CANCELLED });
    renderTab(CANCELLED);

    const edit = await screen.findByRole('button', { name: 'Edit refund of ₱500.00, Oct 5, 2026' });
    const remove = screen.getByRole('button', { name: 'Delete refund of ₱500.00, Oct 5, 2026' });
    expect(edit).toHaveAttribute('title', 'Edit refund of ₱500.00, Oct 5, 2026');
    expect(remove).toHaveAttribute('title', 'Delete refund of ₱500.00, Oct 5, 2026');
  });

  it('keeps the row actions when the cap is 0.00, because Edit and Delete still work', async () => {
    useOrderHandlers({ detail: ALL_REFUNDED });
    renderTab(ALL_REFUNDED);

    expect(await screen.findByRole('button', { name: /^Edit refund of ₱12,000\.00, / })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Delete refund of ₱12,000\.00, / })).toBeVisible();
  });

  it('shows no Add, Edit or Delete on a completed order', async () => {
    const completedWithRefund = buildOrderDetail({ ...completedOrder, refunds: [FIRST] });
    useOrderHandlers({ detail: completedWithRefund });
    renderTab(completedWithRefund);

    await screen.findByRole('table', { name: 'Refunds' });
    expect(screen.queryByRole('button', { name: 'Add Refund' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit refund/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete refund/ })).toBeNull();
  });

  it('shows no Add, Edit or Delete in the read-only deleted view (D-24)', async () => {
    useOrderHandlers({ detail: CANCELLED });
    renderTab(CANCELLED, true);

    await screen.findByRole('table', { name: 'Refunds' });
    expect(screen.queryByRole('button', { name: 'Add Refund' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit refund/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete refund/ })).toBeNull();
    expect(screen.getByText('Money handed back to the customer.')).toBeVisible();
  });

  it('opens Edit Refund from the row and puts focus back on that row Edit button', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: CANCELLED });
    renderTab(CANCELLED);

    await user.click(await screen.findByRole('button', { name: /^Edit refund of ₱500\.00, / }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Refund' });
    expect(within(dialog).getByRole('textbox', { name: /^Amount/ })).toHaveValue('500.00');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Refund' })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Edit refund of ₱500\.00, / })).toHaveFocus();
    });
  });
});

describe('Delete Refund', () => {
  const twoRefunds = buildOrderDetail({
    ...CANCELLED,
    refunds: [FIRST, SECOND],
    totals: { ...CANCELLED.totals, refunded: 800 },
  });

  it('asks "Delete refund of ₱500.00?" and sends DELETE with no key and no version', async () => {
    const user = userEvent.setup();
    const answer = buildOrderDetail({
      ...CANCELLED,
      refunds: [],
      version: 'AAAAAAAAB9F=',
      totals: { ...CANCELLED.totals, refunded: 0 },
    });
    const backend = useOrderHandlers({ detail: CANCELLED, reply: () => HttpResponse.json(answer) });
    renderTab(CANCELLED);

    await user.click(await screen.findByRole('button', { name: /^Delete refund of ₱500\.00, / }));
    const dialog = screen.getByRole('dialog', { name: 'Delete refund of ₱500.00?' });
    expect(dialog).toHaveTextContent('This removes it from ORD-2026-0139 and updates the totals right away.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Refund' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete refund of ₱500.00?' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]).toMatchObject({
      method: 'DELETE',
      path: `/orders/${CANCELLED.id}/refunds/${FIRST_ID}`,
      body: null,
      key: null,
    });
    expect(screen.getByText('Refund deleted')).toBeVisible();
    expect(screen.getByText('No refunds recorded yet.')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Refunds' })).toHaveFocus();
    });
  });

  it('moves focus to the next row Edit button after a delete', async () => {
    const user = userEvent.setup();
    const answer = buildOrderDetail({
      ...twoRefunds,
      refunds: [SECOND],
      version: 'AAAAAAAAB9F=',
      totals: { ...CANCELLED.totals, refunded: 300 },
    });
    useOrderHandlers({ detail: twoRefunds, reply: () => HttpResponse.json(answer) });
    renderTab(twoRefunds);

    await user.click(await screen.findByRole('button', { name: /^Delete refund of ₱500\.00, / }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Refund' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Edit refund of ₱300\.00, / })).toHaveFocus();
    });
  });

  it('shows "This refund was removed." in the dialog when the refund is already gone', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: CANCELLED, reply: () => orderProblem(404, 'orders.refund-not-found') });
    renderTab(CANCELLED);

    await user.click(await screen.findByRole('button', { name: /^Delete refund of ₱500\.00, / }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Refund' }));

    expect(await screen.findByText('This refund was removed.')).toBeVisible();
  });
});
