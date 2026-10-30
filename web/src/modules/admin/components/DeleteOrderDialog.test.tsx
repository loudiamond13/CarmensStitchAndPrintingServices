import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { DeleteOrderDialog, softDeleteSentence } from '@/modules/admin/components/DeleteOrderDialog';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { ordersDeletedKey } from '@/modules/admin/hooks/useRefreshOrders';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  order0148,
  ORDER_STAFF,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The soft delete of an order from its page (ORD-06, D-21, D-22, D-51; plan 08-22): the confirm names the child counts in words,
// the DELETE sends no key and no version, and a finished delete goes back to the list the person came from.

const TITLE = 'Delete ORD-2026-0148?';
const TAIL = 'hidden from every list and total. A Manager can restore it.';

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

describe('softDeleteSentence (D-21, UIC-51)', () => {
  it('names the counts in words and joins the last two with and', () => {
    expect(softDeleteSentence({ items: 3, payments: 2, discounts: 1, expenses: 4 })).toBe(
      `Its 3 items, 2 payments, 1 discount and 4 expenses are ${TAIL}`,
    );
  });

  it('puts refunds before the last and when there are some', () => {
    expect(softDeleteSentence({ items: 3, payments: 2, discounts: 1, expenses: 4, refunds: 2 })).toBe(
      `Its 3 items, 2 payments, 1 discount, 4 expenses and 2 refunds are ${TAIL}`,
    );
  });

  it('leaves out every count that is zero', () => {
    expect(softDeleteSentence({ items: 2, payments: 0, discounts: 0, expenses: 1, refunds: 0 })).toBe(
      `Its 2 items and 1 expense are ${TAIL}`,
    );
  });

  it('reads "is" for a single thing and "are" for two kinds, even when each is one', () => {
    expect(softDeleteSentence({ items: 1, payments: 0, discounts: 0, expenses: 0 })).toBe(`Its 1 item is ${TAIL}`);
    expect(softDeleteSentence({ items: 1, payments: 1, discounts: 0, expenses: 0 })).toBe(
      `Its 1 item and 1 payment are ${TAIL}`,
    );
  });

  it('uses the no-children sentence only when every count is zero', () => {
    expect(softDeleteSentence({ items: 0, payments: 0, discounts: 0, expenses: 0, refunds: 0 })).toBe(`It is ${TAIL}`);
  });

  it('writes 1,234 items with the en-PH thousands separator', () => {
    expect(softDeleteSentence({ items: 1234, payments: 0, discounts: 0, expenses: 0 })).toBe(
      `Its 1,234 items are ${TAIL}`,
    );
  });
});

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

interface RenderOptions {
  order?: OrderDetailFixture;
  /** The list address in the navigation state; null for none. */
  from?: string | null;
  onClose?: () => void;
}

function renderDialog({ order = order0148, from = '/admin/orders?view=table', onClose = vi.fn() }: RenderOptions = {}) {
  const entry = { pathname: `/admin/orders/${order.id}`, state: from === null ? null : { from } };
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Where />
          <Routes>
            <Route path="/admin/orders/:id" element={<DeleteOrderDialog order={order} open onClose={onClose} />} />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

const confirmButton = () => screen.getByRole('button', { name: 'Delete Order' });

describe('the Delete Order confirm (D-21, UIC-51)', () => {
  it('names the order and what is hidden from the loaded arrays, with Cancel focused and nothing to type', async () => {
    useOrderHandlers();
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(within(dialog).getByText(`Its 5 items, 2 payments, 1 discount and 3 expenses are ${TAIL}`)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(confirmButton()).toBeEnabled();
    await expectNoAxeViolations(dialog);
  });

  it('counts refunds when the order has some', async () => {
    useOrderHandlers();
    renderDialog({
      order: buildOrderDetail({
        refunds: [
          {
            id: '00000000-0000-4000-8000-0000000000f1',
            refundDate: '2026-10-05',
            amount: 100,
            reason: 'Wrong size',
            refundedBy: ORDER_STAFF,
            refundedByActive: true,
            recordedBy: ORDER_STAFF,
            recordedAt: '2026-10-05T03:00:00Z',
            lastChangedBy: null,
            lastChangedAt: null,
          },
        ],
      }),
    });

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(
      within(dialog).getByText(`Its 5 items, 2 payments, 1 discount, 3 expenses and 1 refund are ${TAIL}`),
    ).toBeVisible();
  });

  it('closes on Cancel without sending anything', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers();
    const { onClose } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(backend.writes).toEqual([]);
  });
});

describe('confirming the delete (D-22, D-51)', () => {
  it('sends DELETE with no key and no version, goes to the list the person came from, toasts and reads the lists again', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers();
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    const { onClose } = renderDialog();

    await screen.findByRole('dialog', { name: TITLE });
    await user.click(confirmButton());

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/orders?view=table');
    });
    expect(backend.writes).toEqual([{ method: 'DELETE', path: `/orders/${order0148.id}`, body: null, key: null }]);
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText('Order ORD-2026-0148 deleted')).toBeVisible();
    expect(screen.getByText('A Manager can restore it from Deleted Orders.')).toBeVisible();
    expect(invalidated).toEqual(expect.arrayContaining([ordersKey, ordersDeletedKey]));
  });

  it('goes to /admin/orders when there is no list address to return to', async () => {
    const user = userEvent.setup();
    useOrderHandlers();
    renderDialog({ from: null });

    await screen.findByRole('dialog', { name: TITLE });
    await user.click(confirmButton());

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/orders$/);
    });
  });

  it('ignores a return address that is not an Orders path', async () => {
    const user = userEvent.setup();
    useOrderHandlers();
    renderDialog({ from: '/admin/users' });

    await screen.findByRole('dialog', { name: TITLE });
    await user.click(confirmButton());

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/orders$/);
    });
  });

  it('shows Deleting while it runs and sends one request for a double press', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({
      reply: async () => {
        await delay(80);
        return new HttpResponse(null, { status: 204 });
      },
    });
    renderDialog();

    await screen.findByRole('dialog', { name: TITLE });
    await user.dblClick(confirmButton());

    expect(await screen.findByRole('button', { name: 'Deleting' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/orders?view=table');
    });
    expect(backend.writes).toHaveLength(1);
  });

  it('keeps the dialog open with the shared error line when the server fails', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      reply: () =>
        new HttpResponse(JSON.stringify({ title: 'x', status: 500 }), {
          status: 500,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    });
    const { onClose } = renderDialog();

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    await user.click(confirmButton());

    expect(await within(dialog).findByText(/Something went wrong/)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent(`/admin/orders/${order0148.id}`);
  });

  it('says Already deleted, closes and returns to the list when someone else deleted it first (404)', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      reply: () =>
        new HttpResponse(JSON.stringify({ title: 'x', status: 404, code: 'orders.not-found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    });
    const { onClose } = renderDialog();

    await screen.findByRole('dialog', { name: TITLE });
    await user.click(confirmButton());

    expect(await screen.findByText('Already deleted')).toBeVisible();
    expect(screen.getByText('Someone else deleted this order. The list is up to date.')).toBeVisible();
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/orders?view=table');
    });
  });
});
