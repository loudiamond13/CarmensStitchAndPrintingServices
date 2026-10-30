import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { PurgeOrderDialog } from '@/modules/admin/components/PurgeOrderDialog';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { ordersDeletedKey } from '@/modules/admin/hooks/useRefreshOrders';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  deletedOrderDetail,
  deletedOrderList,
  deletedOrdersBackend,
  deletedProblem,
  orderWithCounts,
} from '@/test/deletedOrderFixtures';
import { orderId } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The permanent delete of an order (ORD-06, 07 D-28, D-24, D-57; plan 08-20): the counts first, then the exact order number typed.

const NUMBER = 'ORD-2026-0148';
const ID = orderId(148);
const TITLE = 'Delete ORD-2026-0148 permanently?';
const SENTENCE = 'This will also delete 5 items, 2 payments, 1 discount, and 3 expenses.';

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

interface Handlers {
  onClose: () => void;
  onDone: (outcome: 'purged' | 'gone') => void;
}

function renderDialog(overrides: Partial<Handlers> & { team?: string | null; open?: boolean } = {}) {
  const handlers: Handlers = { onClose: vi.fn(), onDone: vi.fn(), ...overrides };
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PurgeOrderDialog
          orderId={ID}
          number={NUMBER}
          team={overrides.team === undefined ? 'Brgy. San Roque Ballers' : overrides.team}
          customer="Juan Dela Cruz"
          open={overrides.open ?? true}
          onClose={handlers.onClose}
          onDone={handlers.onDone}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return handlers;
}

const confirmButton = () => screen.getByRole('button', { name: 'Delete Order Permanently' });
const numberField = () => screen.getByRole('textbox', { name: `Type ${NUMBER} to confirm` });

describe('reading the counts first (D-24, UIC-16)', () => {
  it('reads the deleted order, shows a skeleton box while it loads, and keeps the confirm disabled', async () => {
    const user = userEvent.setup();
    const backend = deletedOrdersBackend({
      list: deletedOrderList([]),
      detail: async () => {
        await delay(120);
        return deletedOrderDetail();
      },
    });
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(within(dialog).getByRole('status')).toBeInTheDocument();
    expect(within(dialog).queryByText("This can't be undone.")).toBeNull();
    await user.type(numberField(), NUMBER);
    expect(confirmButton()).toBeDisabled();
    expect(backend.reads).toEqual([ID]);

    expect(await within(dialog).findByText(SENTENCE)).toBeVisible();
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(confirmButton()).toBeEnabled();
  });

  it('shows the title, the message, the sentence with refunds, the six tiles with zeros dimmed, and the warning', async () => {
    deletedOrdersBackend({
      list: deletedOrderList([]),
      detail: deletedOrderDetail(
        orderWithCounts(NUMBER, { items: 5, payments: 2, discounts: 1, expenses: 3, refunds: 2 }, ID),
      ),
    });
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(
      within(dialog).getByText(
        'Brgy. San Roque Ballers · Juan Dela Cruz. The order and everything inside it are removed for good.',
      ),
    ).toBeVisible();
    const box = await within(dialog).findByRole('alert');
    expect(
      within(box).getByText('This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 2 refunds.'),
    ).toBeVisible();
    const tiles = within(box)
      .getAllByRole('listitem')
      .map((tile) => tile.textContent);
    expect(tiles).toEqual(['5items', '2payments', '1discount', '3expenses', '2refunds', '0images']);
    expect(within(box).getByText("This can't be undone.")).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: `Type ${NUMBER} to confirm` })).toBeVisible();
    expect(confirmButton()).toBeDisabled();
  });

  it('leaves the team out of the message when the order has none', async () => {
    deletedOrdersBackend({ list: deletedOrderList([]) });
    renderDialog({ team: null });

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(
      within(dialog).getByText('Juan Dela Cruz. The order and everything inside it are removed for good.'),
    ).toBeVisible();
  });

  it('keeps the confirm disabled and says so when the counts cannot be read', async () => {
    const user = userEvent.setup();
    deletedOrdersBackend({ list: deletedOrderList([]), detail: () => deletedProblem(500) });
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(
      await within(dialog).findByText("Couldn't read what this order holds. Close this and try again."),
    ).toBeVisible();
    await user.type(numberField(), NUMBER);
    expect(confirmButton()).toBeDisabled();
    expect(within(dialog).queryByRole('status')).toBeNull();
  });

  it('closes with the already-gone note when the counts read answers 404', async () => {
    const backend = deletedOrdersBackend({ list: deletedOrderList([]), detail: () => deletedProblem(404) });
    const handlers = renderDialog();

    expect(await screen.findByText('Already gone')).toBeVisible();
    expect(handlers.onDone).toHaveBeenCalledWith('gone');
    expect(handlers.onClose).toHaveBeenCalled();
    expect(backend.purges).toEqual([]);
  });
});

describe('the exact order number (07 D-28, EDGE ORD-06 boundary)', () => {
  it('keeps the button disabled for one character off or a different case, and enables it for the exact number with spaces around it', async () => {
    const user = userEvent.setup();
    deletedOrdersBackend({ list: deletedOrderList([]) });
    renderDialog();
    await screen.findByText(SENTENCE);

    await user.type(numberField(), 'ORD-2026-014');
    expect(confirmButton()).toBeDisabled();
    await user.clear(numberField());
    await user.type(numberField(), 'ord-2026-0148');
    expect(confirmButton()).toBeDisabled();
    await user.clear(numberField());
    await user.type(numberField(), 'ORD-2026-01488');
    expect(confirmButton()).toBeDisabled();
    await user.clear(numberField());
    await user.type(numberField(), ` ${NUMBER} `);
    expect(confirmButton()).toBeEnabled();
  });
});

describe('deleting for good', () => {
  async function typeAndConfirm(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText(SENTENCE);
    await user.type(numberField(), NUMBER);
    await user.click(confirmButton());
  }

  it('sends DELETE with confirm= and no Idempotency-Key, then reports, closes, toasts and reads the lists again', async () => {
    const user = userEvent.setup();
    const backend = deletedOrdersBackend({ list: deletedOrderList([]) });
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push(filters?.queryKey);
      return original(filters, options);
    });
    const handlers = renderDialog();

    await typeAndConfirm(user);

    await waitFor(() => {
      expect(handlers.onDone).toHaveBeenCalledWith('purged');
    });
    expect(backend.purges).toEqual([{ id: ID, confirm: NUMBER, key: null }]);
    expect(handlers.onClose).toHaveBeenCalled();
    expect(await screen.findByText('Order permanently deleted')).toBeVisible();
    expect(screen.getByText(NUMBER)).toBeVisible();
    expect(invalidated).toEqual(expect.arrayContaining([ordersKey, ordersDeletedKey]));
  });

  it('shows the server line in the dialog on a 400 and keeps the dialog open with focus on the confirm button', async () => {
    const user = userEvent.setup();
    deletedOrdersBackend({ list: deletedOrderList([]), purge: () => deletedProblem(400) });
    const handlers = renderDialog();

    await typeAndConfirm(user);

    const dialog = screen.getByRole('dialog', { name: TITLE });
    expect(await within(dialog).findByText('Type the order number exactly to delete it for good.')).toBeVisible();
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(confirmButton()).toHaveFocus();
  });

  it('keeps the dialog open with the mapper line on a server failure', async () => {
    const user = userEvent.setup();
    deletedOrdersBackend({ list: deletedOrderList([]), purge: () => deletedProblem(500) });
    const handlers = renderDialog();

    await typeAndConfirm(user);

    const dialog = screen.getByRole('dialog', { name: TITLE });
    expect(await within(dialog).findByText(/Something went wrong/)).toBeVisible();
    expect(handlers.onDone).not.toHaveBeenCalled();
  });

  it('closes with the already-gone note and reads the lists again when the order is gone (404)', async () => {
    const user = userEvent.setup();
    deletedOrdersBackend({ list: deletedOrderList([]), purge: () => deletedProblem(404) });
    const handlers = renderDialog();

    await typeAndConfirm(user);

    expect(await screen.findByText('Already gone')).toBeVisible();
    expect(handlers.onDone).toHaveBeenCalledWith('gone');
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('sends one request for a double press', async () => {
    const user = userEvent.setup();
    const backend = deletedOrdersBackend({
      list: deletedOrderList([]),
      purge: async () => {
        await delay(80);
        return new Response(null, { status: 204 });
      },
    });
    const handlers = renderDialog();
    await screen.findByText(SENTENCE);
    await user.type(numberField(), NUMBER);

    await user.dblClick(confirmButton());

    await waitFor(() => {
      expect(handlers.onDone).toHaveBeenCalledTimes(1);
    });
    expect(backend.purges).toHaveLength(1);
  });

  it('has no axe violations with the counts loaded', async () => {
    deletedOrdersBackend({ list: deletedOrderList([]) });
    renderDialog();
    await screen.findByText(SENTENCE);

    await expectNoAxeViolations(document.body);
  });
});
