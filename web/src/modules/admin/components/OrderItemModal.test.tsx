import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderItemModal } from '@/modules/admin/components/OrderItemModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  order0148,
  ORDER_VERSION,
  orderProblem,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
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
    expect(productType()).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Item' })).toBeInTheDocument();
    await ready();
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
      .map((node) => node.textContent);
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
