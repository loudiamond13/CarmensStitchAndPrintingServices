import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderRefundModal } from '@/modules/admin/components/OrderRefundModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { ME_ID, PAOLO_ID, staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  creditOrder,
  ORDER_TODAY,
  ORDER_VERSION,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// O2 refund window, add mode (ORD-07, ORD-18, D-10, D-11, D-19; plan 08-21): the fields in UI-SPEC order, Refunded by that starts on the
// signed-in person, the credit prefill from Record Refund, the cap helper, and one save with one key and the opened version.

let queryClient: QueryClient;

const NEW_VERSION = 'AAAAAAAAB9F=';

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

interface RenderOptions {
  order?: OrderDetailFixture;
  prefillAmount?: string;
  onClose?: () => void;
  onSaved?: (order: unknown) => void;
}

function renderModal({ order = creditOrder, prefillAmount, onClose = vi.fn(), onSaved = vi.fn() }: RenderOptions = {}) {
  queryClient.setQueryData(orderKey(order.id), order);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderRefundModal mode="add" order={order} prefillAmount={prefillAmount} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

const dateBox = () => screen.getByLabelText<HTMLInputElement>(/^Date/);
const amountBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Amount/ });
const reasonBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Reason/ });
const refundedByBox = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Refunded by/ });
const saveButton = () => screen.getByRole('button', { name: /^(Save Refund|Saving)$/ });

async function ready(): Promise<void> {
  await screen.findByRole('option', { name: 'Paolo Garcia' });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await ready();
  await user.type(amountBox(), '400');
  await user.type(reasonBox(), 'Customer changed the order');
}

/** The order the server answers an add with: a new version, the refund counted and the credit down. */
function answerWith(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return buildOrderDetail({
    ...creditOrder,
    version: NEW_VERSION,
    totals: { ...creditOrder.totals, refunded: 400, customerCredit: 600 },
    ...overrides,
  });
}

describe('add mode opening', () => {
  it('opens as the "Add Refund" dialog with the order and team as its description, and focus on Date', async () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Refund' });
    expect(within(dialog).getByText('ORD-2026-0160 · Lady Spikers QC')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Refund' })).toBeInTheDocument();
    await ready();
    expect(dateBox()).toHaveFocus();
  });

  it("starts with the server's today, no amount, no reason and the signed-in person as Refunded by (D-10, D-11)", async () => {
    renderModal();
    await ready();

    expect(dateBox()).toHaveValue(ORDER_TODAY);
    expect(amountBox()).toHaveValue('');
    expect(reasonBox()).toHaveValue('');
    await waitFor(() => {
      expect(refundedByBox()).toHaveValue(ME_ID);
    });
    expect(within(refundedByBox()).getByRole('option', { name: 'Carmen Reyes (you)' })).toBeInTheDocument();
    expect(refundedByBox()).toHaveAttribute('name', 'refundedByUserId');
    expect(refundedByBox()).toBeRequired();
  });

  it('shows the fields in the UI-SPEC order and no Recorded by block', async () => {
    renderModal();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Add Refund' });
    const labels = within(dialog)
      .getAllByText(/^(Date|Amount|Reason|Refunded by)/)
      .map((node) => node.textContent.replace(/ \*$/, ''));
    expect(labels).toEqual(['Date', 'Amount', 'Reason', 'Refunded by']);
    expect(within(dialog).queryByText('Recorded by')).toBeNull();
  });

  it('fills the amount from Record Refund and shows the cap helper from the credit (D-19)', async () => {
    renderModal({ prefillAmount: '1000.00' });
    await ready();

    expect(amountBox()).toHaveValue('1000.00');
    expect(screen.getByText('You can refund up to ₱1,000.00.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    renderModal({ prefillAmount: '1000.00' });
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('add mode checks before any request (OR-3)', () => {
  it('refuses more than the customer credit in the server words and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal({ prefillAmount: '1000.01' });
    await ready();

    await user.type(reasonBox(), 'Customer changed the order');
    await user.click(saveButton());

    expect(
      await screen.findByText('This is more than the customer credit. Enter ₱1,000.00 or less.'),
    ).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(amountBox()).toHaveFocus();
  });

  it('asks for a reason and focuses it', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal({ prefillAmount: '1000.00' });
    await ready();

    await user.click(saveButton());

    expect(await screen.findByText('Add a short reason for the refund.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(reasonBox()).toHaveFocus();
  });

  it('refuses a date after the server today', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal({ prefillAmount: '1000.00' });
    await ready();
    await user.type(reasonBox(), 'Customer changed the order');

    fireEvent.change(dateBox(), { target: { value: '2026-10-09' } });
    await user.click(saveButton());

    expect(await screen.findByText("The refund date can't be in the future.")).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(dateBox()).toHaveFocus();
  });
});

describe('add mode saving (ORD-18 idempotency)', () => {
  it('posts once with an Idempotency-Key, the chosen refunder and the opened version, then closes and tells the parent', async () => {
    const answer = answerWith();
    const backend: OrderBackend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderModal();
    await fillValid(user);
    await user.selectOptions(refundedByBox(), 'Paolo Garcia');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe(`/orders/${creditOrder.id}/refunds`);
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.body).toEqual({
      refundDate: ORDER_TODAY,
      amount: 400,
      reason: 'Customer changed the order',
      refundedByUserId: PAOLO_ID,
      version: ORDER_VERSION,
    });
  });

  it('sends the signed-in person as the refunder when nobody else is chosen', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ refundedByUserId: ME_ID });
  });

  it("sets the order query from the server's answer", async () => {
    const answer = answerWith();
    useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    await waitFor(() => {
      expect(queryClient.getQueryData(orderKey(creditOrder.id))).toEqual(answer);
    });
  });

  it('toasts "Refund added" with the customer credit from the answer (D-05)', async () => {
    useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Refund added')).toBeInTheDocument();
    expect(screen.getByText('Customer credit now ₱600.00.')).toBeInTheDocument();
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
      expect(screen.getByText('Refund added')).toBeInTheDocument();
    });
    expect(backend.writes).toHaveLength(1);
  });
});
