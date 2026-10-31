import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
  ORDER_STAFF,
  ORDER_STAFF_TWO,
  ORDER_VERSION,
  orderDiscount,
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

// ---- The check reads the order again when the held figures refuse (D-95; plan 08-28) ----

const HELD_FOR = 5_000;
/** The order after another person added an item: the items total is 25,700.00 (the 5% discount is now 1,285.00) and the version moved on. */
const BIGGER_SUBTOTAL = buildOrderDetail({
  version: NEW_VERSION,
  discounts: [orderDiscount('percentage', 5, 'Barangay league discount', 1285)],
  totals: { ...order0148.totals, subtotal: 25700, discount: 1285, total: 24415, balance: 12415 },
});

function regainFocus(): void {
  act(() => {
    focusManager.setFocused(false);
  });
  act(() => {
    focusManager.setFocused(true);
  });
}

describe('add mode reads the order again when the held figures refuse the value (D-95)', () => {
  it('reads once, then sends a value the old items total refused, still with the opened version', async () => {
    const backend = useOrderHandlers({ detail: BIGGER_SUBTOTAL, reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    const { onClose } = renderModal({ heldAge: HELD_FOR });

    await user.type(reasonBox(), 'Big order');
    // 22,450.00 less the 1,122.50 already given leaves 21,327.50; the newer items total leaves 24,415.00.
    await user.type(valueBox(), '22000');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(backend.reads).toEqual([order0148.id]);
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.body).toMatchObject({ kind: 'fixed', value: 22000, version: ORDER_VERSION });
  });

  it('answers 409 with the banner and Load Latest when someone else changed the order meanwhile', async () => {
    const backend = useOrderHandlers({ detail: BIGGER_SUBTOTAL, reply: () => problemResponse(409, 'edit.stale') });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });

    await user.type(reasonBox(), 'Big order');
    await user.type(valueBox(), '22000');
    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Load Latest' })).toBeInTheDocument();
    expect((backend.writes[0]?.body as { version: string }).version).toBe(ORDER_VERSION);
  });

  it('refuses a value still above the current room in the same words, and sends nothing', async () => {
    const backend = useOrderHandlers({ detail: BIGGER_SUBTOTAL });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });

    await user.type(reasonBox(), 'Too much');
    await user.type(valueBox(), '24415.01');
    await user.click(saveButton());

    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(backend.reads).toHaveLength(1);
  });

  it('keeps the held figures in the words when the read fails', async () => {
    const backend = useOrderHandlers({ detail: () => new HttpResponse(null, { status: 500 }) });
    const user = userEvent.setup();
    renderModal({ heldAge: HELD_FOR });

    await user.type(reasonBox(), 'Big order');
    await user.type(valueBox(), '22000');
    await user.click(saveButton());

    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(backend.reads.length).toBeGreaterThan(0);
  });

  it('sends no read for a value the held figures already allow', async () => {
    const backend = useOrderHandlers({ detail: BIGGER_SUBTOTAL, reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    const { onClose } = renderModal({ heldAge: HELD_FOR });

    await user.type(reasonBox(), 'Club');
    await user.type(valueBox(), '500');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(backend.reads).toEqual([]);
  });
});

describe('add mode follows the order while it is open (D-95)', () => {
  it('reads the order on focus and moves the Computed amount of a typed percent to the current items total', async () => {
    const backend = useOrderHandlers({ detail: BIGGER_SUBTOTAL });
    const user = userEvent.setup();
    renderModal();
    await user.click(percentRadio());
    await user.type(valueBox(), '5');
    expect(screen.getByText('Computed amount: ₱1,122.50')).toBeInTheDocument();

    regainFocus();

    expect(await screen.findByText('Computed amount: ₱1,285.00')).toBeInTheDocument();
    expect(backend.reads).toEqual([order0148.id]);
    expect(valueBox()).toHaveValue('5');
  });

  it('still sends the opened version after a focus read', async () => {
    const backend = useOrderHandlers({ detail: BIGGER_SUBTOTAL, reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(reasonBox(), 'Big order');
    await user.click(percentRadio());
    await user.type(valueBox(), '5');
    regainFocus();
    await screen.findByText('Computed amount: ₱1,285.00');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(backend.reads).toHaveLength(1);
    expect(backend.writes[0]?.body).toMatchObject({ kind: 'percentage', value: 5, version: ORDER_VERSION });
  });
});

// ---- Edit mode (ORD-07, D-15, D-44, D-58) ----

const LEAGUE_ID = '00000000-0000-4000-9400-0000000000b1';
const CLUB_ID = '00000000-0000-4000-9400-0000000000b2';
/** A 5% discount (1,122.50 of 22,450.00) and a fixed 500.00 one; the club one was changed once. */
const LEAGUE = orderDiscount('percentage', 5, 'Barangay league discount', 1122.5, { id: LEAGUE_ID });
const CLUB = orderDiscount('fixed', 500, 'Club discount', 500, {
  id: CLUB_ID,
  recordedBy: ORDER_STAFF,
  lastChangedBy: ORDER_STAFF_TWO,
  lastChangedAt: '2026-10-02T04:00:00Z',
});
const TWO_DISCOUNTS = buildOrderDetail({
  discounts: [LEAGUE, CLUB],
  totals: { ...order0148.totals, discount: 1622.5, total: 20827.5, balance: 8827.5 },
});

function renderEdit({
  order = TWO_DISCOUNTS,
  discountId = CLUB_ID,
  onClose = vi.fn(),
  onSaved = vi.fn(),
  heldAge = 0,
  held = order,
}: RenderOptions & { discountId?: string } = {}) {
  hold(held, heldAge);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderDiscountModal mode="edit" order={order} discountId={discountId} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

function problemResponse(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('edit mode opening', () => {
  it('opens as "Edit Discount" with the saved values and the Recorded by block', () => {
    renderEdit();

    const dialog = screen.getByRole('dialog', { name: 'Edit Discount' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(reasonBox()).toHaveValue('Club discount');
    expect(fixedRadio()).toBeChecked();
    expect(valueBox()).toHaveValue('500.00');
    expect(within(dialog).getByText('Recorded by')).toBeInTheDocument();
    expect(within(dialog).getByText('Last changed by')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Discount' })).toBeInTheDocument();
  });

  it('opens a percent discount on Percent with its number as typed text', () => {
    renderEdit({ discountId: LEAGUE_ID });

    expect(percentRadio()).toBeChecked();
    expect(valueBox()).toHaveValue('5');
    expect(screen.getByText('Computed amount: ₱1,122.50')).toBeInTheDocument();
  });

  it('renders nothing for an edit that names no discount', () => {
    queryClient.setQueryData(orderKey(TWO_DISCOUNTS.id), TWO_DISCOUNTS);
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <OrderDiscountModal mode="edit" order={TWO_DISCOUNTS} discountId={null} onClose={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no axe violations', async () => {
    renderEdit();

    await expectNoAxeViolations(document.body);
  });
});

describe('edit mode cap leaves out the discount own saved amount', () => {
  it('lets a fixed discount rise to the items total minus the other discounts, and no further', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderEdit();

    // 22,450.00 less the 1,122.50 of the other discount leaves 21,327.50 for this one.
    await user.clear(valueBox());
    await user.type(valueBox(), '21327.51');
    await user.click(saveButton());
    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);

    await user.clear(valueBox());
    await user.type(valueBox(), '21327.50');
    await user.click(saveButton());
    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
  });

  it('lets a percent discount rise until all the discounts pass the items total', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderEdit({ discountId: LEAGUE_ID });

    // The other discount is 500.00, so 97% (21,776.50) fits and 98% (22,001.00) does not.
    await user.clear(valueBox());
    await user.type(valueBox(), '98');
    await user.click(saveButton());
    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);

    await user.clear(valueBox());
    await user.type(valueBox(), '97');
    await user.click(saveButton());
    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
  });
});

describe('edit mode follows the order (D-95)', () => {
  it('leaves the edited discount out of the current other discounts by id, using the current items total', async () => {
    const current = buildOrderDetail({
      discounts: [orderDiscount('percentage', 5, 'Barangay league discount', 1285, { id: LEAGUE_ID }), CLUB],
      version: NEW_VERSION,
      totals: { ...order0148.totals, subtotal: 25700, discount: 1785, total: 23915, balance: 11915 },
    });
    const backend = useOrderHandlers({ detail: current, reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderEdit({ held: current, heldAge: HELD_FOR });

    // 25,700.00 less the 1,285.00 of the other discount leaves 24,415.00 for this one.
    await user.clear(valueBox());
    await user.type(valueBox(), '24415.01');
    await user.click(saveButton());
    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);

    await user.clear(valueBox());
    await user.type(valueBox(), '24415.00');
    await user.click(saveButton());
    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ value: 24415, version: ORDER_VERSION });
  });

  it('uses the opened figures when the current order no longer holds the discount, and a save answers 404', async () => {
    const current = buildOrderDetail({
      discounts: [orderDiscount('percentage', 5, 'Barangay league discount', 1285, { id: LEAGUE_ID })],
      version: NEW_VERSION,
      totals: { ...order0148.totals, subtotal: 25700, discount: 1285, total: 24415, balance: 12415 },
    });
    const backend = useOrderHandlers({
      detail: current,
      reply: () => problemResponse(404, 'orders.discount-not-found'),
    });
    const user = userEvent.setup();
    renderEdit({ held: current, heldAge: HELD_FOR });

    // The opened figures leave 21,327.50; the current items total alone would allow this.
    await user.clear(valueBox());
    await user.type(valueBox(), '21327.51');
    await user.click(saveButton());
    expect(await screen.findByText(CAP_WORDS)).toBeInTheDocument();
    expect(backend.writes).toEqual([]);

    await user.clear(valueBox());
    await user.type(valueBox(), '21327.50');
    await user.click(saveButton());
    expect(await screen.findByText('This discount was removed.')).toBeInTheDocument();
  });
});

describe('edit mode saving', () => {
  it('puts the changed discount with the opened version and no Idempotency-Key, then closes and toasts "Discount updated"', async () => {
    const answer = answerWith();
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderEdit();

    await user.clear(valueBox());
    await user.type(valueBox(), '750');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('PUT');
    expect(write?.path).toBe(`/orders/${TWO_DISCOUNTS.id}/discounts/${CLUB_ID}`);
    expect(write?.key).toBeNull();
    expect(write?.body).toEqual({ kind: 'fixed', value: 750, reason: 'Club discount', version: ORDER_VERSION });
    expect(await screen.findByText('Discount updated')).toBeInTheDocument();
  });

  it('closes a clean window at once on Cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderEdit();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks "Discard changes?" when Cancel is pressed after a change', async () => {
    const user = userEvent.setup();
    const { onClose } = renderEdit();

    await user.type(reasonBox(), 'x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('edit mode server refusals', () => {
  it('shows the server text in the banner for a 422 orders.discount-above-subtotal and keeps the typed values', async () => {
    useOrderHandlers({
      reply: () => problemResponse(422, 'orders.discount-above-subtotal', { detail: CAP_WORDS }),
    });
    const user = userEvent.setup();
    const { onClose } = renderEdit();

    await user.clear(valueBox());
    await user.type(valueBox(), '900');
    await user.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(CAP_WORDS);
    expect(valueBox()).toHaveValue('900.00');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a 400 on value under Value and focuses it', async () => {
    const message = 'Enter a discount from ₱0.01 to ₱1,000,000.00.';
    useOrderHandlers({
      reply: () => problemResponse(400, 'orders.invalid-request', { errors: { value: [message] } }),
    });
    const user = userEvent.setup();
    renderEdit();

    await user.type(reasonBox(), ' x');
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(valueBox()).toHaveFocus();
  });
});

describe('edit mode stale save (409) and a removed discount (404)', () => {
  it('keeps the typed values behind the banner, and Load Latest takes the latest values, version and cap', async () => {
    const latestClub = orderDiscount('percentage', 10, 'Club discount, renewed', 2245, { id: CLUB_ID });
    const latest = buildOrderDetail({
      discounts: [latestClub],
      version: NEW_VERSION,
      totals: { ...order0148.totals, discount: 2245, total: 20205, balance: 8205 },
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
    await user.clear(valueBox());
    await user.type(valueBox(), '750');

    await user.click(saveButton());
    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    expect(valueBox()).toHaveValue('750.00');

    await user.click(loadLatest);
    await waitFor(() => {
      expect(reasonBox()).toHaveValue('Club discount, renewed');
    });
    expect(percentRadio()).toBeChecked();
    expect(valueBox()).toHaveValue('10');

    await user.click(saveButton());
    await screen.findByText('Discount updated');
    expect((backend.writes[1]?.body as { version: string }).version).toBe(NEW_VERSION);
  });

  it('shows "This discount was removed." for a discount that is gone and blocks Save', async () => {
    useOrderHandlers({ reply: () => problemResponse(404, 'orders.discount-not-found') });
    const user = userEvent.setup();
    renderEdit();

    await user.type(reasonBox(), 'x');
    await user.click(saveButton());

    expect(await screen.findByText('This discount was removed.')).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
