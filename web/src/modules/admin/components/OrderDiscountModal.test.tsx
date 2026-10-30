import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderDiscountModal } from '@/modules/admin/components/OrderDiscountModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  order0148,
  ORDER_VERSION,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// O2 discount window, add mode (ORD-07, D-15, 07 D-12; plan 08-17): Reason, Type and Value in UI-SPEC order, the labelled
// "Computed amount" preview, the server's own words for every rule before any request, and one save with one key and the opened version.

let queryClient: QueryClient;

const NEW_VERSION = 'AAAAAAAAB9F=';
const CAP_WORDS = 'The discounts would be more than the items total. Lower or remove a discount first.';

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
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
        <OrderDiscountModal mode="add" order={order} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

const reasonBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Reason/ });
const valueBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Value/ });
const fixedRadio = () => screen.getByRole('radio', { name: 'Fixed ₱' });
const percentRadio = () => screen.getByRole('radio', { name: 'Percent %' });
const saveButton = () => screen.getByRole('button', { name: /^(Save Discount|Saving)$/ });

/** The order the server answers an add with: a second 5% discount, so the total drops. */
function answerWith(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return buildOrderDetail({
    version: NEW_VERSION,
    totals: { ...order0148.totals, discount: 2245, total: 20205, balance: 8205 },
    ...overrides,
  });
}

describe('add mode opening', () => {
  it('opens as the "Add Discount" dialog with the order and customer as its description, and focus on Reason', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Discount' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Discount' })).toBeInTheDocument();
    expect(reasonBox()).toHaveFocus();
  });

  it('shows Reason, Type and Value in the UI-SPEC order, with the Reason placeholder and no Recorded by block', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Discount' });
    const labels = within(dialog)
      .getAllByText(/^(Reason|Type|Value)/)
      .map((node) => node.textContent.replace(/ \*$/, ''));
    expect(labels).toEqual(['Reason', 'Type', 'Value']);
    expect(reasonBox()).toHaveAttribute('placeholder', 'e.g. Barangay league discount');
    expect(within(dialog).queryByText('Recorded by')).toBeNull();
  });

  it('starts on Fixed with an empty Value that takes the decimal keypad', () => {
    renderModal();

    expect(fixedRadio()).toBeChecked();
    expect(percentRadio()).not.toBeChecked();
    expect(valueBox()).toHaveValue('');
    expect(valueBox()).toHaveAttribute('inputmode', 'decimal');
  });

  it('has no axe violations', async () => {
    renderModal();

    await expectNoAxeViolations(document.body);
  });
});

describe('Type and the Computed amount preview', () => {
  it('clears Value when Type changes and keeps the typed Reason', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '500');
    expect(valueBox()).toHaveValue('500');

    await user.click(percentRadio());

    expect(percentRadio()).toBeChecked();
    expect(valueBox()).toHaveValue('');
    expect(valueBox()).toHaveAttribute('inputmode', 'decimal');
    expect(reasonBox()).toHaveValue('Club');
  });

  it('shows the % mark on a percent Value and the ₱ mark on a fixed one', async () => {
    const user = userEvent.setup();
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Add Discount' });
    expect(within(dialog).getByText('₱')).toBeInTheDocument();

    await user.click(percentRadio());

    expect(within(dialog).getByText('%')).toBeInTheDocument();
    expect(within(dialog).queryByText('₱')).toBeNull();
  });

  it('shows "Computed amount: ₱1,122.50" for 5 percent of the server subtotal of ₱22,450.00', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(percentRadio());
    await user.type(valueBox(), '5');

    expect(screen.getByText('Computed amount: ₱1,122.50')).toBeInTheDocument();
  });

  it('shows a fixed Value as the computed amount', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(valueBox(), '500');

    expect(screen.getByText('Computed amount: ₱500.00')).toBeInTheDocument();
  });

  it('shows ₱0.00 while nothing is typed', () => {
    renderModal();

    expect(screen.getByText('Computed amount: ₱0.00')).toBeInTheDocument();
  });

  it('rounds half away from zero, as the server does', async () => {
    const user = userEvent.setup();
    const small = buildOrderDetail({ discounts: [], totals: { ...order0148.totals, subtotal: 17 } });
    renderModal({ order: small });

    await user.click(percentRadio());
    await user.type(valueBox(), '7.5');

    expect(screen.getByText('Computed amount: ₱1.28')).toBeInTheDocument();
  });

  it('ignores a key that is not a digit or a point in a percent Value', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(percentRadio());
    await user.type(valueBox(), '1a2-5');

    expect(valueBox()).toHaveValue('125');
  });
});

describe('add mode checks before any request (OR-3)', () => {
  it('shows "Enter a reason for the discount." when only the reason is missing, focuses it and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(valueBox(), '500');
    await user.click(saveButton());

    expect(await screen.findByText('Enter a reason for the discount.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(reasonBox()).toHaveFocus();
  });

  it('refuses a reason of 101 characters', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.click(reasonBox());
    await user.paste('a'.repeat(101));
    await user.type(valueBox(), '500');
    await user.click(saveButton());

    expect(await screen.findByText('Keep the reason to 100 characters or fewer.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('asks for a value when Value is empty', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Club');
    await user.click(saveButton());

    expect(await screen.findByText('Enter a discount value.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(valueBox()).toHaveFocus();
  });

  it.each(['0', '101'])('refuses a percent of %s with the percentage words', async (typed) => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'League');
    await user.click(percentRadio());
    await user.type(valueBox(), typed);
    await user.click(saveButton());

    expect(await screen.findByText('Enter a percentage above 0 and up to 100.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('refuses a fixed value of 0 with the fixed words', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '0');
    await user.click(saveButton());

    expect(await screen.findByText('Enter a discount from ₱0.01 to ₱1,000,000.00.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('refuses a percent with a third decimal place', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'League');
    await user.click(percentRadio());
    await user.type(valueBox(), '5.555');
    await user.click(saveButton());

    expect(await screen.findByText('Use at most 2 decimal places.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });

  it('refuses a fixed value above the items total minus the other discounts, and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Too much');
    // 22,450.00 less the 1,122.50 already given leaves 21,327.50.
    await user.type(valueBox(), '21327.51');
    await user.click(saveButton());

    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(valueBox()).toHaveFocus();
  });

  it('accepts a fixed value of exactly what is left under the items total', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Everything');
    await user.type(valueBox(), '21327.50');
    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
  });

  it('refuses a percent that would take the discounts above the items total', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Too much');
    await user.click(percentRadio());
    await user.type(valueBox(), '96');
    await user.click(saveButton());

    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
  });
});

describe('add mode saving (ORD-07 idempotency, D-05)', () => {
  it('posts a 5 percent discount once with an Idempotency-Key and the opened version, then closes and tells the parent', async () => {
    const answer = answerWith();
    const backend: OrderBackend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderModal();

    await user.type(reasonBox(), '  Barangay league discount ');
    await user.click(percentRadio());
    await user.type(valueBox(), '5');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe(`/orders/${order0148.id}/discounts`);
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.body).toEqual({
      kind: 'percentage',
      value: 5,
      reason: 'Barangay league discount',
      version: ORDER_VERSION,
    });
  });

  it('posts a fixed discount with kind "fixed"', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '500');
    await user.click(saveButton());

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toEqual({ kind: 'fixed', value: 500, reason: 'Club', version: ORDER_VERSION });
  });

  it("sets the order query from the server's answer", async () => {
    const answer = answerWith();
    useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '500');
    await user.click(saveButton());

    await waitFor(() => {
      expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(answer);
    });
  });

  it('toasts "Discount added" with the balance line from the answer', async () => {
    useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();

    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '500');
    await user.click(saveButton());

    expect(await screen.findByText('Discount added')).toBeInTheDocument();
    expect(screen.getByText('Balance now ₱8,205.00.')).toBeInTheDocument();
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

    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '500');
    await user.dblClick(saveButton());

    await waitFor(() => {
      expect(screen.getByText('Discount added')).toBeInTheDocument();
    });
    expect(backend.writes).toHaveLength(1);
  });
});
