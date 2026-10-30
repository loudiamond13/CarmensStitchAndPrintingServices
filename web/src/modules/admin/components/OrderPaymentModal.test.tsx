import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  ORDER_TODAY,
  ORDER_VERSION,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { GCASH_ID, listBackend, PAYMENT_METHODS } from '@/test/orderListFixtures';
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
