import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderExpensesTab } from '@/modules/admin/components/OrderExpensesTab';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  FABRIC,
  order0148,
  orderExpense,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { listBackend, ORDER_EXPENSE_CATEGORIES } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Expenses tab actions (ORD-07, ORD-19, D-12, D-15, D-24, D-54a; plan 08-18): Add, Edit and Delete on an active order, each answering
// the whole order, with the page showing the server's figures.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  listBackend('order-expense-categories', ORDER_EXPENSE_CATEGORIES);
  staffBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

/** The tab as the order page draws it: it reads the order from the query, so a saved answer lands on it. */
function Page({ id, readOnly }: { id: string; readOnly?: boolean | undefined }) {
  const query = useOrderQuery(id);
  return query.data === undefined ? null : <OrderExpensesTab order={query.data} readOnly={readOnly} />;
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

const ADDED_ID = '00000000-0000-4000-9300-0000000000aa';

/** The order the server answers an add with: a third expense and the figures it works out. */
function afterAdd(): OrderDetailFixture {
  const added = orderExpense('2026-10-08', FABRIC, 1500, 'Zipper', { id: ADDED_ID });
  return buildOrderDetail({
    expenses: [...order0148.expenses, added],
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, expenses: 7565, profit: 13762.5 },
  });
}

describe('Add Expense', () => {
  it('shows a primary Add Expense button in the tab head of an active order', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab();

    expect(await screen.findByRole('button', { name: 'Add Expense' })).toBeVisible();
  });

  it('opens the Add Expense window from the button', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: order0148 });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Expense' }));

    expect(screen.getByRole('dialog', { name: 'Add Expense' })).toBeInTheDocument();
  });

  it("adds an expense, shows the server's new rows and Order expenses total, and puts focus back on Add Expense", async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(afterAdd()) });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add Expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Expense' });
    await within(dialog).findByRole('option', { name: 'Fabric' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Category/ }), 'Fabric');
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Zipper');
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '1500');
    await user.click(within(dialog).getByRole('button', { name: 'Save Expense' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Expense' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByText('Zipper')).toBeInTheDocument();
    expect(screen.getAllByText('₱7,565.00').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Expense' })).toHaveFocus();
    });
  });
});

describe('locked and deleted views (D-15, D-24)', () => {
  it('shows no expense action on a completed order', async () => {
    useOrderHandlers({ detail: completedOrder });
    renderTab(completedOrder);

    await screen.findByRole('heading', { level: 3, name: 'Expenses' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) expense/i })).toBeNull();
  });

  it('shows no expense action on a cancelled order', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderTab(cancelledOrderWithRefunds);

    await screen.findByRole('heading', { level: 3, name: 'Expenses' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) expense/i })).toBeNull();
  });

  it('shows no Add, Edit or Delete control when readOnly (the deleted view)', async () => {
    useOrderHandlers({ detail: order0148 });
    renderTab(order0148, true);

    await screen.findByRole('table', { name: 'Expenses' });
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete) expense/i })).toBeNull();
  });
});
