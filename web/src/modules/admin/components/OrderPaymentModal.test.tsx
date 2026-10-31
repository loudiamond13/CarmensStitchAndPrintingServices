import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPaymentModal } from '@/modules/admin/components/OrderPaymentModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { ME_ID, PAOLO_ID, staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  order0148,
  ORDER_STAFF,
  ORDER_STAFF_TWO,
  ORDER_TODAY,
  ORDER_VERSION,
  orderPayment,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { CASH_ID, GCASH_ID, listBackend, listItem, PAYMENT_METHODS } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// O2 payment window, add mode (ORD-07, ORD-22, D-09, D-11, D-29, D-48; plan 08-16): the fields in UI-SPEC order, the required Received by
// that starts on the signed-in person, the balance helper, and one save with one key and the opened version.

let queryClient: QueryClient;

const NEW_VERSION = 'AAAAAAAAB9F=';

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  listBackend('payment-methods', PAYMENT_METHODS);
  staffBackend();
});

afterEach(() => {
  focusManager.setFocused(undefined);
  queryClient.clear();
  clearSession();
});

interface RenderOptions {
  order?: OrderDetailFixture;
  onClose?: () => void;
  onSaved?: (order: unknown) => void;
  /** How long ago the page read the held order, in ms. Over a second, a check that fails reads the order again (D-95). */
  heldAge?: number;
  /** The order the page holds when it is not the one the window opened with (another person changed it since). */
  held?: OrderDetailFixture;
}

function hold(order: OrderDetailFixture, heldAge: number): void {
  queryClient.setQueryData(orderKey(order.id), order, heldAge === 0 ? undefined : { updatedAt: Date.now() - heldAge });
}

function renderModal({
  order = order0148,
  onClose = vi.fn(),
  onSaved = vi.fn(),
  heldAge = 0,
  held = order,
}: RenderOptions = {}) {
  hold(held, heldAge);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderPaymentModal mode="add" order={order} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

const dateBox = () => screen.getByLabelText<HTMLInputElement>(/^Date/);
const amountBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Amount/ });
const methodBox = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Method/ });
const referenceBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Reference no\./ });
const receivedByBox = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Received by/ });
const notesBox = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: /^Notes/ });
const saveButton = () => screen.getByRole('button', { name: /^(Save Payment|Saving)$/ });

async function ready(): Promise<void> {
  await screen.findByRole('option', { name: 'GCash' });
  await screen.findByRole('option', { name: 'Paolo Garcia' });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await ready();
  await user.type(amountBox(), '2000');
  await user.selectOptions(methodBox(), 'GCash');
}

/** The order the server answers an add with: a new version, the paid figure up and the balance down. */
function answerWith(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return buildOrderDetail({
    version: NEW_VERSION,
    totals: { ...order0148.totals, paid: 14000, balance: 7327.5 },
    ...overrides,
  });
}

describe('add mode opening', () => {
  it('opens as the "Add Payment" dialog with the order and customer as its description, and focus on Date', async () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Payment' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Payment' })).toBeInTheDocument();
    await ready();
    expect(dateBox()).toHaveFocus();
  });

  it("starts with the server's today, no amount, no method (D-29) and the signed-in person as Received by (D-11)", async () => {
    renderModal();
    await ready();

    expect(dateBox()).toHaveValue(ORDER_TODAY);
    expect(amountBox()).toHaveValue('');
    expect(methodBox()).toHaveValue('');
    expect(within(methodBox()).getByRole('option', { name: 'Choose a method' })).toBeInTheDocument();
    await waitFor(() => {
      expect(receivedByBox()).toHaveValue(ME_ID);
    });
    expect(within(receivedByBox()).getByRole('option', { name: 'Carmen Reyes (you)' })).toBeInTheDocument();
  });

  it('shows the fields in the UI-SPEC order, with the Reference no. placeholder, and no Recorded by block', async () => {
    renderModal();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Add Payment' });
    const labels = within(dialog)
      .getAllByText(/^(Date|Amount|Method|Reference no\.|Received by|Notes)/)
      .map((node) => node.textContent.replace(/ \*$/, ''));
    expect(labels).toEqual(['Date', 'Amount', 'Method', 'Reference no.', 'Received by', 'Notes']);
    expect(referenceBox()).toHaveAttribute('placeholder', 'GCash / Maya / bank ref.');
    expect(notesBox().tagName).toBe('TEXTAREA');
    expect(notesBox()).toHaveAttribute('rows', '3');
    expect(within(dialog).queryByText('Recorded by')).toBeNull();
  });

  it('labels Received by as required and names the field receivedByUserId', async () => {
    renderModal();
    await ready();

    expect(receivedByBox()).toHaveAttribute('name', 'receivedByUserId');
    expect(receivedByBox()).toBeRequired();
  });

  it('shows the server balance under Amount as a preview', async () => {
    renderModal();
    await ready();

    expect(screen.getByText('Balance due: ₱9,327.50')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    renderModal();
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('add mode checks before any request (OR-3)', () => {
  it('shows "Choose a payment method." when only the method is missing, focuses it and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.type(amountBox(), '2000');
    await user.click(saveButton());

    expect(await screen.findByText('Choose a payment method.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(methodBox()).toHaveFocus();
  });

  it('shows the server wording under an empty amount', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.selectOptions(methodBox(), 'GCash');
    await user.click(saveButton());

    expect(await screen.findByText('Enter the amount.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(amountBox()).toHaveFocus();
  });

  it('refuses an amount above the balance and names the most that can be paid', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.type(amountBox(), '9327.51');
    await user.selectOptions(methodBox(), 'GCash');
    await user.click(saveButton());

    expect(await screen.findByText('This is more than the balance. Enter ₱9,327.50 or less.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('refuses a date after the server today', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    fireEvent.change(dateBox(), { target: { value: '2026-10-09' } });
    await user.click(saveButton());

    expect(await screen.findByText("The payment date can't be in the future.")).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(dateBox()).toHaveFocus();
  });

  it('accepts a date before the order date (07 D-41)', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    fireEvent.change(dateBox(), { target: { value: '2026-09-01' } });
    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ paymentDate: '2026-09-01' });
  });
});

describe('add mode saving (ORD-07 idempotency, ORD-08, ORD-22)', () => {
  it('posts once with an Idempotency-Key, the chosen receiver and the opened version, then closes and tells the parent', async () => {
    const answer = answerWith();
    const backend: OrderBackend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderModal();
    await fillValid(user);
    await user.selectOptions(receivedByBox(), 'Paolo Garcia');
    await user.type(referenceBox(), '9012 345');
    await user.type(notesBox(), 'Downpayment');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe(`/orders/${order0148.id}/payments`);
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.body).toEqual({
      paymentDate: ORDER_TODAY,
      amount: 2000,
      paymentMethodId: GCASH_ID,
      reference: '9012 345',
      notes: 'Downpayment',
      receivedByUserId: PAOLO_ID,
      version: ORDER_VERSION,
    });
  });

  it('sends the signed-in person as the receiver when nobody else is chosen, and null for an empty reference and notes', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ receivedByUserId: ME_ID, reference: null, notes: null });
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

  it('toasts "Payment added" with the balance from the answer', async () => {
    useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Payment added')).toBeInTheDocument();
    expect(screen.getByText('Balance now ₱7,327.50.')).toBeInTheDocument();
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
      expect(screen.getByText('Payment added')).toBeInTheDocument();
    });
    expect(backend.writes).toHaveLength(1);
  });
});

// ---- The check reads the order again when the held figures refuse (D-95; plan 08-26) ----

const HELD_FOR = 5_000;
/** The order after another person removed the 2,000.00 payment: more is owed, and the row version moved on. */
const NEWER = buildOrderDetail({
  payments: order0148.payments.slice(0, 1),
  version: NEW_VERSION,
  totals: { ...order0148.totals, paid: 10000, balance: 11327.5 },
});

async function typeAmountAndMethod(user: ReturnType<typeof userEvent.setup>, amount: string): Promise<void> {
  await ready();
  await user.type(amountBox(), amount);
  await user.selectOptions(methodBox(), 'GCash');
}

describe('add mode reads the order again when the held figures refuse the amount (D-95)', () => {
  it('reads once, then sends an amount the old figures refused, still with the opened version', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    const user = userEvent.setup();
    const { onClose } = renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '10000.00');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(backend.reads).toEqual([order0148.id]);
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.body).toMatchObject({ amount: 10000, version: ORDER_VERSION });
  });

  it('answers 409 with the banner and Load Latest when someone else changed the order meanwhile', async () => {
    const backend = useOrderHandlers({ detail: NEWER, reply: () => problemResponse(409, 'edit.stale') });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '10000.00');

    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Load Latest' })).toBeInTheDocument();
    expect((backend.writes[0]?.body as { version: string }).version).toBe(ORDER_VERSION);
  });

  it('shows the current balance under Amount after the read', async () => {
    useOrderHandlers({ detail: NEWER });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '10000.00');

    await user.click(saveButton());

    expect(await screen.findByText('Balance due: ₱11,327.50')).toBeInTheDocument();
  });

  it('refuses an amount above the current balance in the words naming the current figure, and sends nothing', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '12000.00');

    await user.click(saveButton());

    expect(await screen.findByText('This is more than the balance. Enter ₱11,327.50 or less.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(backend.reads).toHaveLength(1);
  });

  it('keeps the held figures in the words when the read fails', async () => {
    const backend = useOrderHandlers({ detail: () => new HttpResponse(null, { status: 500 }) });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '10000.00');

    await user.click(saveButton());

    expect(await screen.findByText('This is more than the balance. Enter ₱9,327.50 or less.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(backend.reads.length).toBeGreaterThan(0);
  });

  it('sends no read for an amount the held figures already allow', async () => {
    const backend = useOrderHandlers({ detail: NEWER, reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    const { onClose } = renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '2000');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(backend.reads).toEqual([]);
  });

  it('shares one read between the blur and the Save that follows within a second', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });
    await typeAmountAndMethod(user, '12000.00');

    await user.click(saveButton());
    await user.click(saveButton());

    await screen.findByText('This is more than the balance. Enter ₱11,327.50 or less.');
    expect(backend.reads).toHaveLength(1);
  });
});

describe('add mode follows the order while it is open (D-95)', () => {
  function regainFocus(): void {
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });
  }

  it('reads the order when the tab regains focus and shows the current balance, with focus left where it was', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    renderModal();
    await ready();
    expect(dateBox()).toHaveFocus();

    regainFocus();

    expect(await screen.findByText('Balance due: ₱11,327.50')).toBeInTheDocument();
    expect(backend.reads).toEqual([order0148.id]);
    expect(dateBox()).toHaveFocus();
  });

  it('still sends the opened version after a focus read', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await ready();
    regainFocus();
    await screen.findByText('Balance due: ₱11,327.50');
    await user.type(amountBox(), '10000.00');
    await user.selectOptions(methodBox(), 'GCash');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(backend.reads).toHaveLength(1);
    expect(backend.writes[0]?.body).toMatchObject({ amount: 10000, version: ORDER_VERSION });
  });
});

// ---- Edit mode (ORD-08, ORD-22, D-44, D-58, UIC-29, UIC-44) ----

const CASH_REF = { id: CASH_ID, name: 'Cash', tone: 'success', retired: false };
const RETIRED_ID = '7a2b9e10-3c55-4a1d-8e7f-4c0d2e5a0009';
const RETIRED_REF = { id: RETIRED_ID, name: 'Maya', tone: 'neutral', retired: true };
const GONE_ID = '00000000-0000-4000-8000-0000000000d1';

/** The payment the edit tests open: 2,000 in cash, received by Paolo, recorded by Carmen, never changed. */
const SAVED = orderPayment('2026-10-03', CASH_REF, 2000, {
  id: '00000000-0000-4000-9200-0000000000b1',
  reference: 'REF-1',
  notes: 'For 2 added coach polos',
  receivedBy: ORDER_STAFF_TWO,
});
const FIRST = orderPayment('2026-09-28', CASH_REF, 10000, { id: '00000000-0000-4000-9200-0000000000b2' });
const TWO_PAYMENTS = buildOrderDetail({ payments: [FIRST, SAVED] });

function renderEdit({
  order = TWO_PAYMENTS,
  paymentId = SAVED.id,
  onClose = vi.fn(),
  onSaved = vi.fn(),
  heldAge = 0,
  held = order,
}: RenderOptions & { paymentId?: string } = {}) {
  hold(held, heldAge);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderPaymentModal mode="edit" order={order} paymentId={paymentId} onClose={onClose} onSaved={onSaved} />
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

/** Waits for the staff lookup so the saved receiver shows as chosen. */
async function receiverIs(id: string): Promise<void> {
  await waitFor(() => {
    expect(receivedByBox()).toHaveValue(id);
  });
}

describe('edit mode opening', () => {
  it('opens as "Edit Payment" with the saved values and the Recorded by block', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Edit Payment' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(dateBox()).toHaveValue('2026-10-03');
    expect(amountBox()).toHaveValue('2000.00');
    expect(methodBox()).toHaveValue(CASH_ID);
    expect(referenceBox()).toHaveValue('REF-1');
    expect(notesBox()).toHaveValue('For 2 added coach polos');
    await receiverIs(PAOLO_ID);
    expect(within(dialog).getByText('Recorded by')).toBeInTheDocument();
    expect(within(dialog).getByText('Last changed by')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Payment' })).toBeInTheDocument();
  });

  it('shows the server balance plus the saved amount under Amount, and the cap follows it', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderEdit();
    await ready();

    expect(screen.getByText('Balance due: ₱11,327.50')).toBeInTheDocument();
    await user.clear(amountBox());
    await user.type(amountBox(), '11327.51');
    await user.click(saveButton());

    expect(await screen.findByText('This is more than the balance. Enter ₱11,327.50 or less.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('takes the cap from the current order and its copy of the payment when another person changed the payment', async () => {
    const changed = orderPayment('2026-10-03', CASH_REF, 3000, { id: SAVED.id, receivedBy: ORDER_STAFF_TWO });
    const current = buildOrderDetail({
      payments: [FIRST, changed],
      version: NEW_VERSION,
      totals: { ...order0148.totals, paid: 13000, balance: 8000 },
    });
    const backend = useOrderHandlers({ detail: current });
    const user = userEvent.setup();
    renderEdit({ held: current, heldAge: HELD_FOR });
    await ready();

    expect(screen.getByText('Balance due: ₱11,000.00')).toBeInTheDocument();
    await user.clear(amountBox());
    await user.type(amountBox(), '11000.01');
    await user.click(saveButton());

    expect(await screen.findByText('This is more than the balance. Enter ₱11,000.00 or less.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('uses the opened figures for the cap when the current order no longer holds the payment, and a save answers 404', async () => {
    const current = buildOrderDetail({
      payments: [FIRST],
      version: NEW_VERSION,
      totals: { ...order0148.totals, paid: 10000, balance: 5000 },
    });
    useOrderHandlers({ detail: current, reply: () => problemResponse(404, 'orders.payment-not-found') });
    const user = userEvent.setup();
    renderEdit({ held: current, heldAge: HELD_FOR });
    await ready();

    expect(screen.getByText('Balance due: ₱11,327.50')).toBeInTheDocument();
    await user.type(referenceBox(), 'x');
    await user.click(saveButton());

    expect(await screen.findByText('This payment was removed.')).toBeInTheDocument();
  });

  it('keeps a receiver who was deactivated selected as "{name} (inactive)"', async () => {
    useOrderHandlers();
    const gone = { id: GONE_ID, name: 'Liza Santos', formerStaff: false };
    const payment = orderPayment('2026-10-03', CASH_REF, 2000, {
      id: SAVED.id,
      receivedBy: gone,
      receivedByActive: false,
    });
    renderEdit({ order: buildOrderDetail({ payments: [FIRST, payment] }) });
    await ready();

    await receiverIs(GONE_ID);
    expect(within(receivedByBox()).getByRole('option', { name: 'Liza Santos (inactive)' })).toBeInTheDocument();
  });

  it('keeps a deleted receiver selected as "{name} (former staff)"', async () => {
    useOrderHandlers();
    const gone = { id: GONE_ID, name: 'Liza Santos', formerStaff: true };
    const payment = orderPayment('2026-10-03', CASH_REF, 2000, {
      id: SAVED.id,
      receivedBy: gone,
      receivedByActive: false,
    });
    renderEdit({ order: buildOrderDetail({ payments: [FIRST, payment] }) });
    await ready();

    await receiverIs(GONE_ID);
    expect(within(receivedByBox()).getByRole('option', { name: 'Liza Santos (former staff)' })).toBeInTheDocument();
  });

  it('keeps a retired method selected as "{name} (retired)"', async () => {
    listBackend('payment-methods', [
      ...PAYMENT_METHODS,
      listItem(RETIRED_ID, 'Maya', 'neutral', { status: 'retired' }),
    ]);
    useOrderHandlers();
    const payment = orderPayment('2026-10-03', RETIRED_REF, 2000, { id: SAVED.id });
    renderEdit({ order: buildOrderDetail({ payments: [FIRST, payment] }) });
    await ready();

    expect(within(methodBox()).getByRole('option', { name: 'Maya (retired)' })).toBeInTheDocument();
    expect(methodBox()).toHaveValue(RETIRED_ID);
  });

  it('has no axe violations', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('edit mode saving', () => {
  it('puts the changed payment with the opened version and no Idempotency-Key, then closes and toasts "Payment updated"', async () => {
    const answer = answerWith();
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderEdit();
    await ready();
    await receiverIs(PAOLO_ID);

    await user.clear(amountBox());
    await user.type(amountBox(), '2500');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('PUT');
    expect(write?.path).toBe(`/orders/${TWO_PAYMENTS.id}/payments/${SAVED.id}`);
    expect(write?.key).toBeNull();
    expect(write?.body).toEqual({
      paymentDate: '2026-10-03',
      amount: 2500,
      paymentMethodId: CASH_ID,
      reference: 'REF-1',
      notes: 'For 2 added coach polos',
      receivedByUserId: PAOLO_ID,
      version: ORDER_VERSION,
    });
    expect(await screen.findByText('Payment updated')).toBeInTheDocument();
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

    await user.type(referenceBox(), 'x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('edit mode server refusals (UIC-29)', () => {
  it('shows a 400 on receivedByUserId under Received by and focuses it', async () => {
    const message = "This person can't be chosen because their account isn't active. Choose someone else.";
    useOrderHandlers({
      reply: () => problemResponse(400, 'orders.invalid-request', { receivedByUserId: [message] }),
    });
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    await ready();
    await receiverIs(PAOLO_ID);

    await user.selectOptions(receivedByBox(), 'Liza Mercado');
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(receivedByBox()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a 400 on paymentMethodId under Method and focuses it', async () => {
    const message = 'This payment method was retired. Choose another one.';
    useOrderHandlers({
      reply: () => problemResponse(400, 'orders.invalid-request', { paymentMethodId: [message] }),
    });
    const user = userEvent.setup();
    renderEdit();
    await ready();

    await user.selectOptions(methodBox(), 'GCash');
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(methodBox()).toHaveFocus();
  });
});

describe('edit mode stale save (409) and a removed payment (404)', () => {
  it('keeps the typed values behind the banner, and Load Latest takes the latest values, version and cap', async () => {
    const latestPayment = orderPayment('2026-10-04', CASH_REF, 3000, {
      id: SAVED.id,
      reference: 'REF-2',
      receivedBy: ORDER_STAFF,
      lastChangedBy: ORDER_STAFF_TWO,
      lastChangedAt: '2026-10-05T04:00:00Z',
    });
    const latest = buildOrderDetail({
      payments: [FIRST, latestPayment],
      version: 'AAAAAAAAB9F=',
      totals: { ...order0148.totals, paid: 13000, balance: 8000 },
    });
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
    await receiverIs(PAOLO_ID);
    await user.clear(amountBox());
    await user.type(amountBox(), '2500');

    await user.click(saveButton());
    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    expect(amountBox()).toHaveValue('2500.00');

    await user.click(loadLatest);
    await waitFor(() => {
      expect(amountBox()).toHaveValue('3000.00');
    });
    expect(referenceBox()).toHaveValue('REF-2');
    expect(receivedByBox()).toHaveValue(ME_ID);
    expect(screen.getByText('Balance due: ₱11,000.00')).toBeInTheDocument();

    await user.click(saveButton());
    await screen.findByText('Payment updated');
    expect((backend.writes[1]?.body as { version: string }).version).toBe('AAAAAAAAB9F=');
  });

  it('shows "This payment was removed." for a payment that is gone and blocks Save', async () => {
    useOrderHandlers({ reply: () => problemResponse(404, 'orders.payment-not-found') });
    const user = userEvent.setup();
    renderEdit();
    await ready();

    await user.type(referenceBox(), 'x');
    await user.click(saveButton());

    expect(await screen.findByText('This payment was removed.')).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
