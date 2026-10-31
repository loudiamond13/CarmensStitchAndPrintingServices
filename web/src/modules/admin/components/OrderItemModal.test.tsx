import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderItemModal } from '@/modules/admin/components/OrderItemModal';
import { orderKey, useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  order0148,
  ORDER_STAFF_TWO,
  ORDER_VERSION,
  orderItem,
  orderProblem,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { BASKETBALL_ID, OLD_TYPE_ID } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// O2 item window, add mode (ORD-05, D-28; plan 08-14): the fields in UI-SPEC order, one save with one key and the opened version,
// the server's answer on the page and in the toast.

let queryClient: QueryClient;

const NEW_VERSION = 'AAAAAAAAB9F=';

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
        <OrderItemModal mode="add" order={order} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onClose, onSaved };
}

const productType = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Product type/ });
const sizeVariant = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Size \/ variant/ });
const description = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Description/ });
const quantity = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Quantity/ });
const unitPrice = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Unit price/ });
const saveButton = () => screen.getByRole('button', { name: /^(Save Item|Saving)$/ });

async function ready(): Promise<void> {
  await screen.findByRole('option', { name: 'Basketball Jersey' });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await ready();
  await user.selectOptions(productType(), 'Basketball Jersey');
  await user.type(sizeVariant(), 'S-XL');
  await user.type(description(), 'Warm-up jacket');
  await user.type(quantity(), '12');
  await user.type(unitPrice(), '780');
}

/** The order the server answers an add with: one more item, a new version and a smaller balance. */
function answerWith(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return buildOrderDetail({
    version: NEW_VERSION,
    totals: { ...order0148.totals, subtotal: 31810, total: 30217.5, balance: 18217.5 },
    ...overrides,
  });
}

describe('add mode opening', () => {
  it('opens as the "Add Item" dialog with the order and customer as its description, and focus on Product type', async () => {
    useOrderHandlers();
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Item' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Item' })).toBeInTheDocument();
    // The Product type box is disabled while its list loads, so it takes the cursor when the list arrives.
    await ready();
    await waitFor(() => {
      expect(productType()).toHaveFocus();
    });
  });

  it('names the customer when the order has no team', async () => {
    useOrderHandlers();
    renderModal({ order: buildOrderDetail({ teamName: null }) });

    expect(screen.getByText('ORD-2026-0148 · Juan Dela Cruz')).toBeInTheDocument();
    await ready();
  });

  it('shows the fields in order, with the placeholders, and no Recorded by block', async () => {
    useOrderHandlers();
    renderModal();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Add Item' });
    const labels = within(dialog)
      .getAllByText(/^(Product type|Size \/ variant|Description|Quantity|Unit price)/)
      .map((node) => node.textContent.replace(/ \*$/, ''));
    expect(labels).toEqual(['Product type', 'Size / variant', 'Description', 'Quantity', 'Unit price']);
    expect(sizeVariant()).toHaveAttribute('placeholder', 'e.g. S-XL');
    expect(description()).toHaveAttribute('placeholder', 'e.g. Jersey top, sublimated');
    expect(quantity()).toHaveAttribute('inputmode', 'numeric');
    expect(within(dialog).queryByText('Recorded by')).toBeNull();
  });

  it('previews the line total from what is typed', async () => {
    useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.type(quantity(), '12');
    await user.type(unitPrice(), '780.50');

    expect(screen.getByText('Line total: ₱9,366.00')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    useOrderHandlers();
    renderModal();
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('add mode checks before any request (OR-3)', () => {
  it('shows the server wording under each empty required field and sends nothing', async () => {
    const backend = useOrderHandlers();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.click(saveButton());

    expect(await screen.findByText('Choose a product type.')).toBeInTheDocument();
    expect(screen.getByText('Describe the item.')).toBeInTheDocument();
    expect(screen.getByText('Enter a quantity from 1 to 10,000.')).toBeInTheDocument();
    expect(screen.getByText('Enter a unit price.')).toBeInTheDocument();
    expect(backend.writes).toEqual([]);
    expect(productType()).toHaveFocus();
  });
});

describe('add mode saving (ORD-07 idempotency, ORD-08)', () => {
  it('posts once with an Idempotency-Key and the opened version, then closes and tells the parent', async () => {
    const answer = answerWith();
    const backend: OrderBackend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderModal();
    await fillValid(user);

    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe(`/orders/${order0148.id}/items`);
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.body).toEqual({
      productTypeId: expect.any(String) as unknown,
      description: 'Warm-up jacket',
      sizeVariant: 'S-XL',
      quantity: 12,
      unitPrice: 780,
      version: ORDER_VERSION,
    });
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

  it('toasts "Item added" with the balance from the answer', async () => {
    useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Item added')).toBeInTheDocument();
    expect(screen.getByText('Balance now ₱18,217.50.')).toBeInTheDocument();
  });

  it('toasts the customer credit when the answer shows one', async () => {
    const credit = answerWith({
      totals: { ...order0148.totals, balance: -500, customerCredit: 500, fullyPaid: true },
    });
    useOrderHandlers({ reply: () => HttpResponse.json(credit) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Customer credit now ₱500.00.')).toBeInTheDocument();
  });

  it('toasts "Order is now fully paid." when the answer has no balance left', async () => {
    const paid = answerWith({
      totals: { ...order0148.totals, balance: 0, customerCredit: 0, fullyPaid: true },
    });
    useOrderHandlers({ reply: () => HttpResponse.json(paid) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Order is now fully paid.')).toBeInTheDocument();
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

    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    await user.click(saveButton());

    await screen.findByText('Item added');
    expect(backend.writes).toHaveLength(1);
  });

  it('shows "Saving" while the request runs and ignores Esc and the scrim', async () => {
    useOrderHandlers({
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(answerWith());
      },
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await fillValid(user);

    await user.click(saveButton());
    expect(await screen.findByRole('button', { name: 'Saving' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('puts a server 400 on the quantity field and focuses it', async () => {
    useOrderHandlers({
      reply: () =>
        new HttpResponse(
          JSON.stringify({ title: 'x', status: 400, errors: { quantity: ['Enter a quantity from 1 to 10,000.'] } }),
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('Enter a quantity from 1 to 10,000.')).toBeInTheDocument();
    expect(quantity()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the same key when the same values are sent again after a network failure', async () => {
    let calls = 0;
    const backend = useOrderHandlers({
      reply: () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json(answerWith());
      },
    });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());
    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    await waitFor(() => {
      expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
    });
    await user.click(saveButton());

    await screen.findByText('Item added');
    expect(backend.writes).toHaveLength(2);
    expect(backend.writes[1]?.key).toBe(backend.writes[0]?.key);
  });
});

describe('add mode refusals', () => {
  it('shows the server text for 422 orders.too-many-items and keeps the window open', async () => {
    useOrderHandlers({
      reply: () =>
        new HttpResponse(
          JSON.stringify({
            title: 'x',
            status: 422,
            code: 'orders.too-many-items',
            detail: 'An order can have at most 100 items.',
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('An order can have at most 100 items.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the problem line for a 500 without server text', async () => {
    useOrderHandlers({ reply: () => orderProblem(500) });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});

// ---- Edit mode (ORD-08, D-44, D-58, UIC-9, UIC-20, UIC-22, UIC-23, UIC-25) ----

const BASKETBALL_REF = { id: BASKETBALL_ID, name: 'Basketball Jersey', tone: 'accent', retired: false };
const RETIRED_REF = { id: OLD_TYPE_ID, name: 'Old Style Jersey', tone: 'neutral', retired: true };

/** The item the edit tests open: recorded by Carmen, never changed. */
const SHORTS = orderItem(BASKETBALL_REF, 'Shorts, matching colorway', 15, 300, {
  id: '00000000-0000-4000-9100-0000000000b1',
  sizeVariant: 'S-XL',
});
const OTHER = orderItem(BASKETBALL_REF, 'Jersey top', 15, 650, { id: '00000000-0000-4000-9100-0000000000b2' });
const TWO_ITEMS = buildOrderDetail({ items: [OTHER, SHORTS] });

/** Watches the order the way the order page does, so a refusal that reads it again is seen. */
function OrderProbe({ id }: { id: string }) {
  useOrderQuery(id);
  return null;
}

function renderEdit({
  order = TWO_ITEMS,
  itemId = SHORTS.id,
  onClose = vi.fn(),
  onSaved = vi.fn(),
}: RenderOptions & { itemId?: string } = {}) {
  queryClient.setQueryData(orderKey(order.id), order);
  const tree = (current: OrderDetailFixture) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrderProbe id={current.id} />
        <OrderItemModal mode="edit" order={current} itemId={itemId} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>
  );
  const view = render(tree(order));
  return {
    ...view,
    onClose,
    onSaved,
    rerenderWith: (current: OrderDetailFixture) => {
      view.rerender(tree(current));
    },
  };
}

function problemResponse(status: number, code: string, detail?: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code, ...(detail === undefined ? {} : { detail }) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('edit mode opening', () => {
  it('opens as "Edit Item" with the item values, the customer description and the Recorded by block', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    const dialog = screen.getByRole('dialog', { name: 'Edit Item' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(productType()).toHaveValue(BASKETBALL_ID);
    expect(sizeVariant()).toHaveValue('S-XL');
    expect(description()).toHaveValue('Shorts, matching colorway');
    expect(quantity()).toHaveValue('15');
    expect(unitPrice()).toHaveValue('300.00');
    expect(within(dialog).getByText('Line total: ₱4,500.00')).toBeInTheDocument();
    expect(within(dialog).getByText('Recorded by')).toBeInTheDocument();
    expect(within(dialog).getByText('Carmen Reyes', { exact: false })).toBeInTheDocument();
  });

  it('shows no Last changed by value for an item that was never changed (UIC-9)', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    const term = screen.getByText('Last changed by');
    const row = term.closest('div');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Not set')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('Carmen Reyes')).toBeNull();
  });

  it('shows Last changed by with the person once the item was changed (D-44)', async () => {
    useOrderHandlers();
    const changed = orderItem(BASKETBALL_REF, 'Shorts, matching colorway', 15, 300, {
      id: SHORTS.id,
      lastChangedBy: ORDER_STAFF_TWO,
      lastChangedAt: '2026-10-02T04:00:00Z',
    });
    renderEdit({ order: buildOrderDetail({ items: [OTHER, changed] }) });
    await ready();

    const row = screen.getByText('Last changed by').closest('div');
    expect(within(row as HTMLElement).getByText('Paolo Garcia', { exact: false })).toBeInTheDocument();
  });

  it('keeps a retired own type listed as "{name} (retired)" and selected', async () => {
    useOrderHandlers();
    const retired = orderItem(RETIRED_REF, 'Old shirt', 3, 400, { id: SHORTS.id });
    renderEdit({ order: buildOrderDetail({ items: [OTHER, retired] }) });
    await ready();

    expect(screen.getByRole('option', { name: 'Old Style Jersey (retired)' })).toBeInTheDocument();
    expect(productType()).toHaveValue(OLD_TYPE_ID);
  });

  it('has no axe violations', async () => {
    useOrderHandlers();
    renderEdit();
    await ready();

    await expectNoAxeViolations(document.body);
  });
});

describe('edit mode saving', () => {
  it('puts the changed item with the opened version and no Idempotency-Key, then closes and toasts "Item updated"', async () => {
    const answer = answerWith();
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answer) });
    const user = userEvent.setup();
    const { onClose, onSaved } = renderEdit();
    await ready();

    await user.clear(quantity());
    await user.type(quantity(), '20');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(answer);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('PUT');
    expect(write?.path).toBe(`/orders/${TWO_ITEMS.id}/items/${SHORTS.id}`);
    expect(write?.key).toBeNull();
    expect(write?.body).toEqual({
      productTypeId: BASKETBALL_ID,
      description: 'Shorts, matching colorway',
      sizeVariant: 'S-XL',
      quantity: 20,
      unitPrice: 300,
      version: ORDER_VERSION,
    });
    expect(await screen.findByText('Item updated')).toBeInTheDocument();
  });

  it('keeps the version it opened with when a focus refetch brings a newer order (ORD-07 concurrency)', async () => {
    const backend = useOrderHandlers({ reply: () => HttpResponse.json(answerWith()) });
    const user = userEvent.setup();
    const { rerenderWith } = renderEdit();
    await ready();

    rerenderWith(buildOrderDetail({ items: [OTHER, SHORTS], version: 'AAAAAAAAB9G=' }));
    await user.clear(quantity());
    await user.type(quantity(), '20');
    await user.click(saveButton());

    await screen.findByText('Item updated');
    expect((backend.writes[0]?.body as { version: string }).version).toBe(ORDER_VERSION);
  });
});

describe('edit mode stale save (409, UIC-20)', () => {
  it('shows the conflict banner, keeps the typed values, and Load Latest replaces the values and the version', async () => {
    const latestItem = orderItem(BASKETBALL_REF, 'Shorts, new colorway', 18, 310, {
      id: SHORTS.id,
      sizeVariant: 'M',
      lastChangedBy: ORDER_STAFF_TWO,
      lastChangedAt: '2026-10-02T04:00:00Z',
    });
    const latest = buildOrderDetail({ items: [OTHER, latestItem], version: 'AAAAAAAAB9F=' });
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
    await user.clear(quantity());
    await user.type(quantity(), '20');

    await user.click(saveButton());

    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    expect(screen.getByText('This was changed by someone else.')).toBeInTheDocument();
    expect(loadLatest).toHaveFocus();
    expect(quantity()).toHaveValue('20');

    await user.click(loadLatest);

    await waitFor(() => {
      expect(quantity()).toHaveValue('18');
    });
    expect(description()).toHaveValue('Shorts, new colorway');
    expect(unitPrice()).toHaveValue('310.00');
    expect(sizeVariant()).toHaveValue('M');
    expect(screen.queryByRole('button', { name: 'Load Latest' })).toBeNull();
    expect(screen.getByText('Latest version loaded. Make your changes again.')).toBeInTheDocument();
    expect(productType()).toHaveFocus();
    expect(screen.getByText('Paolo Garcia', { exact: false })).toBeInTheDocument();

    await user.click(saveButton());
    await screen.findByText('Item updated');
    expect((backend.writes[1]?.body as { version: string }).version).toBe('AAAAAAAAB9F=');
  });

  it('says the item was removed when the latest order no longer has it, and blocks Save', async () => {
    const latest = buildOrderDetail({ items: [OTHER], version: 'AAAAAAAAB9F=' });
    useOrderHandlers({ detail: latest, reply: () => problemResponse(409, 'edit.stale') });
    const user = userEvent.setup();
    renderEdit();
    await ready();
    await user.clear(quantity());
    await user.type(quantity(), '20');
    await user.click(saveButton());

    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));

    expect(await screen.findByText('This item was removed.')).toBeInTheDocument();
    expect(screen.getByText('Close this and check the order.')).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('edit mode refusals', () => {
  it('on 422 orders.locked shows the server text, makes Save aria-disabled and reads the order again (UIC-22)', async () => {
    const backend = useOrderHandlers({
      reply: () => problemResponse(422, 'orders.locked', 'This order is completed. Reopen it to make changes.'),
    });
    const user = userEvent.setup();
    renderEdit();
    await ready();
    await user.clear(quantity());
    await user.type(quantity(), '20');
    const reads = backend.reads.length;

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('This order is completed. Reopen it to make changes.');
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => {
      expect(backend.reads.length).toBeGreaterThan(reads);
    });
  });

  it('on 422 discount-above-subtotal shows the server text and leaves Save usable (UIC-23)', async () => {
    useOrderHandlers({
      reply: () =>
        problemResponse(
          422,
          'orders.discount-above-subtotal',
          'The discounts would be more than the items total. Lower or remove a discount first.',
        ),
    });
    const user = userEvent.setup();
    renderEdit();
    await ready();
    await user.clear(quantity());
    await user.type(quantity(), '2');

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The discounts would be more than the items total. Lower or remove a discount first.',
    );
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('on 404 says the item was removed and makes Save aria-disabled (UIC-25)', async () => {
    useOrderHandlers({ reply: () => problemResponse(404, 'orders.item-not-found') });
    const user = userEvent.setup();
    renderEdit();
    await ready();
    await user.clear(quantity());
    await user.type(quantity(), '20');

    await user.click(saveButton());

    expect(await screen.findByText('This item was removed.')).toBeInTheDocument();
    expect(screen.getByText('Close this and check the order.')).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('add mode stale save (UIC-20)', () => {
  it('Load Latest refreshes the order and keeps what was typed, and the next save sends the new version', async () => {
    const latest = buildOrderDetail({ version: 'AAAAAAAAB9F=' });
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: latest,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? problemResponse(409, 'edit.stale') : HttpResponse.json(answerWith());
      },
    });
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);
    await user.click(saveButton());

    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load Latest' })).toBeNull();
    });
    expect(description()).toHaveValue('Warm-up jacket');
    expect(quantity()).toHaveValue('12');
    expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(latest);

    await user.click(saveButton());
    await screen.findByText('Item added');
    expect((backend.writes[1]?.body as { version: string }).version).toBe('AAAAAAAAB9F=');
    expect(backend.writes[1]?.key).not.toBe(backend.writes[0]?.key);
  });
});

describe('closing with typed values (D-58, UIC-43)', () => {
  it('closes at once when nothing was changed', async () => {
    useOrderHandlers();
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  });

  it('asks "Discard changes?" after a change, and Keep Editing keeps the typed value', async () => {
    useOrderHandlers();
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    await ready();
    await user.type(description(), ' v2');

    await user.keyboard('{Escape}');

    const question = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(question).getByRole('button', { name: 'Keep Editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(description()).toHaveValue('Shorts, matching colorway v2');
  });

  it('asks on a half filled add window and closes on Discard Changes', async () => {
    useOrderHandlers();
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await ready();
    await user.type(description(), 'Half');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
