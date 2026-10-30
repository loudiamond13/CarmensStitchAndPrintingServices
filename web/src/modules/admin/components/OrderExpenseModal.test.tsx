import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderExpenseModal } from '@/modules/admin/components/OrderExpenseModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { ME_ID, PAOLO_ID, staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  order0148,
  orderExpense,
  ORDER_STAFF,
  ORDER_STAFF_TWO,
  ORDER_TODAY,
  ORDER_VERSION,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { FABRIC_ID, LABOR_ID, listBackend, listItem, ORDER_EXPENSE_CATEGORIES } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// O2 order expense window, add and edit modes (ORD-07, ORD-19, ORD-23, D-11, D-12, D-30; plan 08-18): the fields in UI-SPEC order, the required
// Paid by that starts on the signed-in person, the date limit in the server's words, and one save with one key and the opened version. Edit mode follows
// the add tests below.

let queryClient: QueryClient;

const NEW_VERSION = 'AAAAAAAAB9F=';

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

interface RenderOptions {
  order?: OrderDetailFixture;
  onClose?: () => void;
  onSaved?: (order: unknown) => void;
}

function renderModal({ order = order0148, onClose = vi.fn(), onSaved = vi.fn() }: RenderOptions = {}) {
  queryClient.setQueryData(orderKey(order.id), order);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderExpenseModal mode="add" order={order} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

const dateBox = () => screen.getByLabelText<HTMLInputElement>(/^Date/);
const categoryBox = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Category/ });
const descriptionBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Description/ });
const amountBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Amount/ });
const paidByBox = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Paid by/ });
const saveButton = () => screen.getByRole('button', { name: /^(Save Expense|Saving)$/ });

async function ready(): Promise<void> {
  await screen.findByRole('option', { name: 'Fabric' });
  await screen.findByRole('option', { name: 'Paolo Garcia' });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await ready();
  await user.type(amountBox(), '1500');
  await user.selectOptions(categoryBox(), 'Fabric');
}

/** The order the server answers an add with: a new version, the expenses up and the profit down. */
function answerWith(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return buildOrderDetail({
    version: NEW_VERSION,
    totals: { ...order0148.totals, expenses: 7565, profit: 13762.5 },
    ...overrides,
  });
}

describe('add mode opening', () => {
  it('opens as the "Add Expense" dialog with the order and customer as its description, and focus on Date', async () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Expense' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Expense' })).toBeInTheDocument();
    await ready();
    expect(dateBox()).toHaveFocus();
  });

  it('starts with the server today, "Choose a category" and the signed-in person as Paid by', async () => {
    renderModal();
    await ready();

    expect(dateBox()).toHaveValue(ORDER_TODAY);
    expect(categoryBox()).toHaveValue('');
    expect(within(categoryBox()).getByRole('option', { name: 'Choose a category' })).toBeInTheDocument();
    expect(descriptionBox()).toHaveValue('');
    expect(amountBox()).toHaveValue('');
    await waitFor(() => {
      expect(paidByBox()).toHaveValue(ME_ID);
    });
    expect(within(paidByBox()).getByRole('option', { name: 'Carmen Reyes (you)' })).toBeInTheDocument();
  });

  it('shows the fields in the UI-SPEC order, with the date hint and the description placeholder, and no Recorded by block', async () => {
    renderModal();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Add Expense' });
    const labels = within(dialog)
      .getAllByText(/^(Date|Category|Description|Amount|Paid by)/)
      .map((node) => node.textContent.replace(/ \*$/, ''));
    expect(labels).toEqual(['Date', 'Category', 'Description', 'Amount', 'Paid by']);
    expect(within(dialog).getByText("Up to 30 days ahead is fine for a cost you'll pay soon.")).toBeInTheDocument();
    expect(descriptionBox()).toHaveAttribute('placeholder', 'e.g. Dri-fit mesh, 45 yds');
    expect(within(dialog).queryByText('Recorded by')).toBeNull();
  });

  it('names the payer field paidByUserId and the category field orderExpenseCategoryId, both required', async () => {
    renderModal();
    await ready();

    expect(paidByBox()).toHaveAttribute('name', 'paidByUserId');
    expect(paidByBox()).toBeRequired();
    expect(categoryBox()).toHaveAttribute('name', 'orderExpenseCategoryId');
    expect(categoryBox()).toBeRequired();
    expect(descriptionBox()).not.toBeRequired();
  });

  it('has no axe violations', async () => {
    renderModal();
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('add mode checks before any request (OR-3)', () => {
  it('shows "Choose a category." when only the category is missing, focuses it and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.type(amountBox(), '1500');
    await user.click(saveButton());

    expect(await screen.findByText('Choose a category.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(categoryBox()).toHaveFocus();
  });

  it('shows the server wording under an amount of 0 and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.selectOptions(categoryBox(), 'Fabric');
    await user.type(amountBox(), '0');
    await user.click(saveButton());

    expect(await screen.findByText('Enter an amount greater than ₱0.00.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(amountBox()).toHaveFocus();
  });

  it('refuses a date 31 days after today and names the latest day', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    fireEvent.change(dateBox(), { target: { value: '2026-11-08' } });
    await user.click(saveButton());

    expect(
      await screen.findByText('Choose a date up to 30 days from today, Nov 7, 2026 at the latest.'),
    ).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(dateBox()).toHaveFocus();
  });

  it('accepts a date 30 days after today', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    fireEvent.change(dateBox(), { target: { value: '2026-11-07' } });
    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ expenseDate: '2026-11-07' });
  });

  it('refuses a description over 200 characters', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    fireEvent.change(descriptionBox(), { target: { value: 'x'.repeat(201) } });
    await user.click(saveButton());

    expect(await screen.findByText('Keep the description to 200 characters or fewer.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });
});

describe('add mode saving (ORD-07 idempotency, ORD-08, ORD-23)', () => {
  it('posts once with an Idempotency-Key, the chosen payer and the opened version, then closes and tells the parent', async () => {
    const answer = answerWith();
    const backend: OrderBackend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderModal();
    await fillValid(user);
    await user.selectOptions(paidByBox(), 'Paolo Garcia');
    await user.type(descriptionBox(), 'Dri-fit mesh, 45 yds');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe(`/orders/${order0148.id}/expenses`);
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.body).toEqual({
      expenseDate: ORDER_TODAY,
      orderExpenseCategoryId: FABRIC_ID,
      description: 'Dri-fit mesh, 45 yds',
      amount: 1500,
      paidByUserId: PAOLO_ID,
      version: ORDER_VERSION,
    });
  });

  it('sends the signed-in person as the payer when nobody else is chosen, and null for an empty description', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ paidByUserId: ME_ID, description: null });
  });

  it("sets the order query from the server's answer", async () => {
    const answer = answerWith();
    useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    await waitFor(() => {
      expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(answer);
    });
  });

  it('toasts "Expense added" with the order expenses from the answer', async () => {
    useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Expense added')).toBeInTheDocument();
    expect(screen.getByText('Order expenses now ₱7,565.00.')).toBeInTheDocument();
  });

  it('sends one request for a double click', async () => {
    const backend = useOrderHandlers({
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(answerWith());
      },
    });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.dblClick(saveButton());

    await waitFor(() => {
      expect(screen.getByText('Expense added')).toBeInTheDocument();
    });
    expect(backend.writes).toHaveLength(1);
  });
});

// ---- Edit mode (ORD-07, ORD-23, D-12, D-44, D-58, UIC-29, UIC-44) ----

const FABRIC_REF = { id: FABRIC_ID, name: 'Fabric', tone: 'warning', retired: false };
const RETIRED_ID = '9c4e1d20-5b66-4c2e-a8b1-6d1e3f7a0008';
const RETIRED_REF = { id: RETIRED_ID, name: 'Sewing thread', tone: 'neutral', retired: true };
const GONE_ID = '00000000-0000-4000-8000-0000000000d1';

/** The expense the edit tests open: 3,825 of fabric paid by Paolo, recorded by Carmen, never changed. */
const SAVED = orderExpense('2026-10-03', FABRIC_REF, 3825, 'Dri-fit mesh, 45 yds', {
  id: '00000000-0000-4000-9300-0000000000b1',
  paidBy: ORDER_STAFF_TWO,
});
const OTHER = orderExpense('2026-10-01', FABRIC_REF, 640, 'Zipper', { id: '00000000-0000-4000-9300-0000000000b2' });
const TWO_EXPENSES = buildOrderDetail({ expenses: [OTHER, SAVED] });

function renderEdit({
  order = TWO_EXPENSES,
  expenseId = SAVED.id,
  onClose = vi.fn(),
  onSaved = vi.fn(),
}: RenderOptions & { expenseId?: string } = {}) {
  queryClient.setQueryData(orderKey(order.id), order);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderExpenseModal mode="edit" order={order} expenseId={expenseId} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

function problemResponse(status: number, code: string, errors?: Record<string, string[]>): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code, ...(errors === undefined ? {} : { errors }) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** Waits for the staff lookup so the saved payer shows as chosen. */
async function payerIs(id: string): Promise<void> {
  await waitFor(() => {
    expect(paidByBox()).toHaveValue(id);
  });
}

describe('edit mode opening', () => {
  it('opens as "Edit Expense" with the saved values and the Recorded by block', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Edit Expense' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(dateBox()).toHaveValue('2026-10-03');
    expect(categoryBox()).toHaveValue(FABRIC_ID);
    expect(descriptionBox()).toHaveValue('Dri-fit mesh, 45 yds');
    expect(amountBox()).toHaveValue('3825.00');
    await payerIs(PAOLO_ID);
    expect(within(dialog).getByText('Recorded by')).toBeInTheDocument();
    expect(within(dialog).getByText('Last changed by')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Expense' })).toBeInTheDocument();
  });

  it('shows an empty description as an empty box', async () => {
    useOrderHandlers();
    const bare = orderExpense('2026-10-03', FABRIC_REF, 100, null, { id: SAVED.id });
    renderEdit({ order: buildOrderDetail({ expenses: [OTHER, bare] }) });
    await ready();

    expect(descriptionBox()).toHaveValue('');
  });

  it('keeps a payer who was deactivated selected as "{name} (inactive)"', async () => {
    useOrderHandlers();
    const gone = { id: GONE_ID, name: 'Liza Santos', formerStaff: false };
    const expense = orderExpense('2026-10-03', FABRIC_REF, 3825, 'Mesh', {
      id: SAVED.id,
      paidBy: gone,
      paidByActive: false,
    });
    renderEdit({ order: buildOrderDetail({ expenses: [OTHER, expense] }) });
    await ready();

    await payerIs(GONE_ID);
    expect(within(paidByBox()).getByRole('option', { name: 'Liza Santos (inactive)' })).toBeInTheDocument();
  });

  it('keeps a deleted payer selected as "{name} (former staff)"', async () => {
    useOrderHandlers();
    const gone = { id: GONE_ID, name: 'Liza Santos', formerStaff: true };
    const expense = orderExpense('2026-10-03', FABRIC_REF, 3825, 'Mesh', {
      id: SAVED.id,
      paidBy: gone,
      paidByActive: false,
    });
    renderEdit({ order: buildOrderDetail({ expenses: [OTHER, expense] }) });
    await ready();

    await payerIs(GONE_ID);
    expect(within(paidByBox()).getByRole('option', { name: 'Liza Santos (former staff)' })).toBeInTheDocument();
  });

  it('keeps a retired category selected as "{name} (retired)"', async () => {
    listBackend('order-expense-categories', [
      ...ORDER_EXPENSE_CATEGORIES,
      listItem(RETIRED_ID, 'Sewing thread', 'neutral', { status: 'retired' }),
    ]);
    useOrderHandlers();
    const expense = orderExpense('2026-10-03', RETIRED_REF, 3825, 'Thread', { id: SAVED.id });
    renderEdit({ order: buildOrderDetail({ expenses: [OTHER, expense] }) });
    await ready();

    expect(within(categoryBox()).getByRole('option', { name: 'Sewing thread (retired)' })).toBeInTheDocument();
    expect(categoryBox()).toHaveValue(RETIRED_ID);
  });

  it('has no axe violations', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('edit mode saving', () => {
  it('puts the changed expense with the opened version and no Idempotency-Key, then closes and toasts "Expense updated"', async () => {
    const answer = answerWith();
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderEdit();
    await ready();
    await payerIs(PAOLO_ID);

    await user.clear(amountBox());
    await user.type(amountBox(), '4000');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('PUT');
    expect(write?.path).toBe(`/orders/${TWO_EXPENSES.id}/expenses/${SAVED.id}`);
    expect(write?.key).toBeNull();
    expect(write?.body).toEqual({
      expenseDate: '2026-10-03',
      orderExpenseCategoryId: FABRIC_ID,
      description: 'Dri-fit mesh, 45 yds',
      amount: 4000,
      paidByUserId: PAOLO_ID,
      version: ORDER_VERSION,
    });
    expect(await screen.findByText('Expense updated')).toBeInTheDocument();
    expect(screen.getByText('Order expenses now ₱7,565.00.')).toBeInTheDocument();
  });

  it('closes a clean window at once on Cancel', async () => {
    useOrderHandlers();
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks "Discard changes?" when Cancel is pressed after a change', async () => {
    useOrderHandlers();
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    await ready();

    await user.type(descriptionBox(), 'x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('edit mode server refusals (UIC-29)', () => {
  it('shows a 400 on paidByUserId under Paid by and focuses it', async () => {
    const message = "This person can't be chosen because their account isn't active. Choose someone else.";
    useOrderHandlers({
      reply: () => problemResponse(400, 'orders.invalid-request', { paidByUserId: [message] }),
    });
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    await ready();
    await payerIs(PAOLO_ID);

    await user.selectOptions(paidByBox(), 'Liza Mercado');
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(paidByBox()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a 400 on orderExpenseCategoryId under Category and focuses it', async () => {
    const message = 'This category was retired. Choose another one.';
    useOrderHandlers({
      reply: () => problemResponse(400, 'orders.invalid-request', { orderExpenseCategoryId: [message] }),
    });
    const user = userEvent.setup();
    renderEdit();
    await ready();

    await user.selectOptions(categoryBox(), 'Labor');
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(categoryBox()).toHaveFocus();
  });
});

describe('edit mode stale save (409) and a removed expense (404)', () => {
  it('keeps the typed values behind the banner, and Load Latest takes the latest values and version', async () => {
    const latestExpense = orderExpense('2026-10-04', FABRIC_REF, 4200, 'Dri-fit mesh, 50 yds', {
      id: SAVED.id,
      paidBy: ORDER_STAFF,
      lastChangedBy: ORDER_STAFF_TWO,
      lastChangedAt: '2026-10-05T04:00:00Z',
    });
    const latest = buildOrderDetail({ expenses: [OTHER, latestExpense], version: 'AAAAAAAAB9F=' });
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: latest,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? problemResponse(409, 'edit.stale') : HttpResponse.json(answerWith());
      },
    });
    const user = userEvent.setup();
    renderEdit();
    await ready();
    await payerIs(PAOLO_ID);
    await user.clear(amountBox());
    await user.type(amountBox(), '4000');

    await user.click(saveButton());
    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    expect(amountBox()).toHaveValue('4000.00');

    await user.click(loadLatest);
    await waitFor(() => {
      expect(amountBox()).toHaveValue('4200.00');
    });
    expect(descriptionBox()).toHaveValue('Dri-fit mesh, 50 yds');
    expect(paidByBox()).toHaveValue(ME_ID);

    await user.click(saveButton());
    await screen.findByText('Expense updated');
    expect((backend.writes[1]?.body as { version: string }).version).toBe('AAAAAAAAB9F=');
  });

  it('shows "This expense was removed." for an expense that is gone and blocks Save', async () => {
    useOrderHandlers({ reply: () => problemResponse(404, 'orders.expense-not-found') });
    const user = userEvent.setup();
    renderEdit();
    await ready();

    await user.type(descriptionBox(), 'x');
    await user.click(saveButton());

    expect(await screen.findByText('This expense was removed.')).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
