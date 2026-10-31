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
  INK_AND_PAPER,
  order0148,
  orderExpense,
  ORDER_STAFF_TWO,
  OUTSOURCING,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { listBackend, ORDER_EXPENSE_CATEGORIES } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { inStrictMode } from '@/test/strictMode';

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

// ---- Edit and Delete (D-12, D-15, D-54a, D-05) ----

const MESH_ID = '00000000-0000-4000-9300-0000000000b1';
const INK_ID = '00000000-0000-4000-9300-0000000000b2';
const EMBROIDERY_ID = '00000000-0000-4000-9300-0000000000b3';
const MESH = orderExpense('2026-10-01', FABRIC, 3825, 'Dri-fit mesh, 45 yds', { id: MESH_ID });
const INK = orderExpense('2026-10-02', INK_AND_PAPER, 1640, 'Sublimation ink', { id: INK_ID });
const EMBROIDERY = orderExpense('2026-10-04', OUTSOURCING, 600, 'Embroidery, coach polos', { id: EMBROIDERY_ID });
const THREE = buildOrderDetail({ expenses: [MESH, INK, EMBROIDERY] });

/** The order the server answers a delete with: the given expenses and the figures it works out. */
function afterRemoval(expenses: OrderDetailFixture['expenses'], spent: number): OrderDetailFixture {
  return buildOrderDetail({
    expenses,
    version: 'AAAAAAAAB9F=',
    totals: { ...order0148.totals, expenses: spent, profit: 21327.5 - spent },
  });
}

function problemResponse(status: number, code: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('row actions (D-54a)', () => {
  it('names each row action by its amount and date, with a matching title', async () => {
    useOrderHandlers({ detail: THREE });
    renderTab(THREE);

    const edit = await screen.findByRole('button', { name: 'Edit expense of ₱3,825.00, Oct 1, 2026' });
    const remove = screen.getByRole('button', { name: 'Delete expense of ₱3,825.00, Oct 1, 2026' });
    expect(edit).toHaveAttribute('title', 'Edit expense of ₱3,825.00, Oct 1, 2026');
    expect(remove).toHaveAttribute('title', 'Delete expense of ₱3,825.00, Oct 1, 2026');
    expect(screen.getByRole('button', { name: 'Edit expense of ₱600.00, Oct 4, 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete expense of ₱600.00, Oct 4, 2026' })).toBeInTheDocument();
  });

  it('keeps Paid by and Recorded by on every row beside its actions', async () => {
    const paidByPaolo = orderExpense('2026-10-01', FABRIC, 3825, 'Mesh', { id: MESH_ID, paidBy: ORDER_STAFF_TWO });
    const order = buildOrderDetail({ expenses: [paidByPaolo] });
    useOrderHandlers({ detail: order });
    renderTab(order);

    const rows = within(await screen.findByRole('table', { name: 'Expenses' })).getAllByRole('row');
    const row = rows.find((candidate) => within(candidate).queryByText('Mesh') !== null);
    if (row === undefined) throw new Error('No Mesh row');
    expect(within(row).getByText('Paolo Garcia')).toBeVisible();
    expect(within(row).getByText('Carmen Reyes')).toBeVisible();
  });
});

describe('Edit Expense', () => {
  it('opens the window with the row values and puts focus back on that row Edit after a save', async () => {
    const user = userEvent.setup();
    const answer = buildOrderDetail({
      expenses: [orderExpense('2026-10-01', FABRIC, 4000, 'Dri-fit mesh, 45 yds', { id: MESH_ID }), INK, EMBROIDERY],
      version: 'AAAAAAAAB9F=',
      totals: { ...order0148.totals, expenses: 6240, profit: 15087.5 },
    });
    const backend = useOrderHandlers({ detail: THREE, reply: () => HttpResponse.json(answer) });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Edit expense of ₱3,825.00, Oct 1, 2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Expense' });
    expect(within(dialog).getByRole('textbox', { name: /^Description/ })).toHaveValue('Dri-fit mesh, 45 yds');
    const amount = within(dialog).getByRole('textbox', { name: /^Amount/ });
    expect(amount).toHaveValue('3825.00');
    await user.clear(amount);
    await user.type(amount, '4000');
    await user.click(within(dialog).getByRole('button', { name: 'Save Expense' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Expense' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.method).toBe('PUT');
    expect(screen.getAllByText('₱6,240.00').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit expense of ₱4,000.00, Oct 1, 2026' })).toHaveFocus();
    });
  });
});

describe('Delete expense of', () => {
  it('asks "Delete expense of ₱3,825.00?" with the order number, then deletes with no key and no version', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      detail: THREE,
      reply: () => HttpResponse.json(afterRemoval([INK, EMBROIDERY], 2240)),
    });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Delete expense of ₱3,825.00, Oct 1, 2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete expense of ₱3,825.00?' });
    expect(dialog).toHaveTextContent('This removes it from ORD-2026-0148 and updates the totals right away.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Expense' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete expense of ₱3,825.00?' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]).toMatchObject({
      method: 'DELETE',
      path: `/orders/${THREE.id}/expenses/${MESH_ID}`,
      key: null,
      body: null,
    });
  });

  it('applies the answer, toasts "Expense deleted" with the order expenses, and focuses the next row Edit', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE, reply: () => HttpResponse.json(afterRemoval([MESH, EMBROIDERY], 4425)) });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Delete expense of ₱1,640.00, Oct 2, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete Expense' }));

    expect(await screen.findByText('Expense deleted')).toBeInTheDocument();
    expect(screen.getByText('Order expenses now ₱4,425.00.')).toBeInTheDocument();
    expect(screen.queryByText('Sublimation ink')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit expense of ₱600.00, Oct 4, 2026' })).toHaveFocus();
    });
  });

  it('focuses the previous row Edit when the last row is deleted', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE, reply: () => HttpResponse.json(afterRemoval([MESH, INK], 5465)) });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Delete expense of ₱600.00, Oct 4, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete Expense' }));

    await screen.findByText('Expense deleted');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit expense of ₱1,640.00, Oct 2, 2026' })).toHaveFocus();
    });
  });

  it('focuses the tab heading when no expense is left', async () => {
    const user = userEvent.setup();
    const single = buildOrderDetail({ expenses: [MESH] });
    useOrderHandlers({ detail: single, reply: () => HttpResponse.json(afterRemoval([], 0)) });
    renderTab(single);

    await user.click(await screen.findByRole('button', { name: 'Delete expense of ₱3,825.00, Oct 1, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete Expense' }));

    expect(await screen.findByText('No expenses recorded yet.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Expenses' })).toHaveFocus();
    });
  });

  it('says "This expense was removed." when the expense is already gone (404)', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: THREE, reply: () => problemResponse(404, 'orders.expense-not-found') });
    renderTab(THREE);

    await user.click(await screen.findByRole('button', { name: 'Delete expense of ₱3,825.00, Oct 1, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete Expense' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This expense was removed.');
    expect(screen.getByRole('dialog', { name: 'Delete expense of ₱3,825.00?' })).toBeInTheDocument();
  });

  it('closes with Cancel, sends nothing and returns focus to that row Delete', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: THREE });
    renderTab(THREE);
    const remove = await screen.findByRole('button', { name: 'Delete expense of ₱3,825.00, Oct 1, 2026' });

    await user.click(remove);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.writes).toEqual([]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete expense of ₱3,825.00, Oct 1, 2026' })).toHaveFocus();
    });
  });
});

describe('under StrictMode', () => {
  it('draws the tab with the same rows, whether the render is cached or fresh', async () => {
    useOrderHandlers({ detail: order0148 });
    await inStrictMode(async () => {
      renderTab();
      expect(await screen.findByRole('table', { name: 'Expenses' })).toBeVisible();
    });
  });
});
