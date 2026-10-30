import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
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
