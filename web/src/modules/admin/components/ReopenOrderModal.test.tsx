import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { reopenDefault, ReopenOrderModal } from '@/modules/admin/components/ReopenOrderModal';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  order0148,
  ORDER_STAFF,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Reopen Order window (ORD-07, D-15, D-16, D-57; plan 08-19): a Completed or Cancelled order goes back to an active status the
// person picks. The window starts on the status the order was in before the end state, else Pending.

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

type Change = OrderDetailResponse['statusHistory'][number];

function change(from: string | null, to: string, at: string): Change {
  return { from, to, changedAt: at, changedBy: ORDER_STAFF };
}

/** A Cancelled order that was Ready when it was cancelled. */
const cancelledFromReady: OrderDetailFixture = buildOrderDetail({
  ...cancelledOrderWithRefunds,
  statusHistory: [
    change(null, 'pending', '2026-09-08T02:00:00Z'),
    change('pending', 'ready', '2026-09-12T02:00:00Z'),
    change('ready', 'cancelled', '2026-09-20T02:00:00Z'),
  ],
});

function reopened(status: string): OrderDetailFixture {
  return buildOrderDetail({
    ...cancelledFromReady,
    status,
    statusHistory: [...cancelledFromReady.statusHistory, change('cancelled', status, '2026-10-08T03:00:00Z')],
    version: 'AAAAAAAAB9F=',
  });
}

function refusal(status: number, code: string, detail: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

interface RenderOptions {
  order?: OrderDetailResponse;
  open?: boolean;
  onClose?: () => void;
  onReopened?: (answer: OrderDetailResponse) => void;
}

function renderModal({ order = cancelledFromReady, open = true, onClose, onReopened }: RenderOptions = {}) {
  const user = userEvent.setup();
  const close = onClose ?? vi.fn();
  const done = onReopened ?? vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <ReopenOrderModal order={order} open={open} onClose={close} onReopened={done} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, onClose: close, onReopened: done, ...view };
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: /^Reopen / });
}

describe('reopenDefault (D-16, UIC-47)', () => {
  it('is the status the order was in before the end state', () => {
    expect(reopenDefault(cancelledFromReady)).toBe('ready');
  });

  it('is the newest row that ended in the current end state', () => {
    const order = buildOrderDetail({
      status: 'cancelled',
      statusHistory: [
        change(null, 'pending', '2026-09-01T02:00:00Z'),
        change('pending', 'cancelled', '2026-09-02T02:00:00Z'),
        change('cancelled', 'production', '2026-09-03T02:00:00Z'),
        change('production', 'cancelled', '2026-09-04T02:00:00Z'),
      ],
    });

    expect(reopenDefault(order)).toBe('production');
  });

  it('is Pending when no row ended in the current end state', () => {
    expect(reopenDefault(buildOrderDetail({ status: 'cancelled' }))).toBe('pending');
  });

  it('is Pending when the row that ended it has no earlier status', () => {
    const order = buildOrderDetail({
      status: 'cancelled',
      statusHistory: [change(null, 'cancelled', '2026-09-01T02:00:00Z')],
    });

    expect(reopenDefault(order)).toBe('pending');
  });

  it('is Pending when the earlier status was an end state, not an active one', () => {
    const order = buildOrderDetail({
      status: 'cancelled',
      statusHistory: [
        change(null, 'pending', '2026-09-01T02:00:00Z'),
        change('completed', 'cancelled', '2026-09-02T02:00:00Z'),
      ],
    });

    expect(reopenDefault(order)).toBe('pending');
  });
});

describe('the window (D-16, D-57)', () => {
  it('is titled with the order number and says what to choose', () => {
    useOrderHandlers();
    renderModal();

    const box = screen.getByRole('dialog', { name: 'Reopen ORD-2026-0139' });
    expect(within(box).getByText('Choose the status to go back to.')).toBeVisible();
  });

  it('offers the five active statuses in a group named Reopen as', () => {
    useOrderHandlers();
    renderModal();

    const group = within(dialog()).getByRole('group', { name: 'Reopen as' });
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-labelledby'))
      .map((id) => (id === null ? '' : (document.getElementById(id)?.textContent ?? '')));
    expect(labels).toEqual(['Pending', 'Mockup', 'In Production', 'Ready', 'Delivered']);
  });

  it('preselects the status before the end state', () => {
    useOrderHandlers();
    renderModal();

    expect(within(dialog()).getByRole('radio', { name: 'Ready' })).toBeChecked();
    expect(within(dialog()).getByRole('radio', { name: 'Pending' })).not.toBeChecked();
  });

  it('preselects Pending when the history gives no active status to go back to', () => {
    useOrderHandlers();
    renderModal({ order: completedOrder });

    expect(within(dialog()).getByRole('radio', { name: 'Pending' })).toBeChecked();
  });

  it('puts focus on the preselected status when it opens', async () => {
    useOrderHandlers();
    renderModal();

    await waitFor(() => {
      expect(within(dialog()).getByRole('radio', { name: 'Ready' })).toHaveFocus();
    });
  });

  it('draws Cancel and a primary Reopen Order with the lock-open icon', () => {
    useOrderHandlers();
    renderModal();

    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeVisible();
    const confirm = within(dialog()).getByRole('button', { name: 'Reopen Order' });
    expect(confirm.querySelector('svg.lucide-lock-open')).not.toBeNull();
  });

  it('closes on Cancel without sending anything', async () => {
    const backend = useOrderHandlers();
    const { user, onClose } = renderModal();

    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backend.writes).toHaveLength(0);
  });

  it('starts again from the default each time it opens', async () => {
    useOrderHandlers();
    const { user, rerender, onClose, onReopened } = renderModal();
    await user.click(within(dialog()).getByRole('radio', { name: 'Delivered' }));
    expect(within(dialog()).getByRole('radio', { name: 'Delivered' })).toBeChecked();

    const tree = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <ReopenOrderModal order={cancelledFromReady} open={open} onClose={onClose} onReopened={onReopened} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
    rerender(tree(false));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    rerender(tree(true));

    expect(within(dialog()).getByRole('radio', { name: 'Ready' })).toBeChecked();
  });

  it('has no axe violations', async () => {
    useOrderHandlers();
    const { container } = renderModal();

    await expectNoAxeViolations(container);
  });
});

describe('reopening (D-16, 05 D-21)', () => {
  it('sends the chosen status with an Idempotency-Key and no version, then closes and toasts', async () => {
    const backend = useOrderHandlers({ detail: cancelledFromReady, reply: () => HttpResponse.json(reopened('ready')) });
    const { user, onClose, onReopened } = renderModal();

    await user.click(within(dialog()).getByRole('button', { name: 'Reopen Order' }));

    expect(await screen.findByText('Order reopened')).toBeVisible();
    expect(screen.getByText('ORD-2026-0139 is now Ready.')).toBeVisible();
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.path).toBe(`/orders/${cancelledFromReady.id}/status`);
    expect(backend.writes[0]?.body).toEqual({ status: 'ready' });
    expect(backend.writes[0]?.key).toMatch(/\S/);
    expect(onReopened).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends the status that was picked instead, using the wire key of In Production', async () => {
    const backend = useOrderHandlers({
      detail: cancelledFromReady,
      reply: () => HttpResponse.json(reopened('production')),
    });
    const { user } = renderModal();

    await user.click(within(dialog()).getByRole('radio', { name: 'In Production' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Reopen Order' }));

    await screen.findByText('ORD-2026-0139 is now In Production.');
    expect(backend.writes[0]?.body).toEqual({ status: 'production' });
  });

  it('shows Reopening on the button while the request runs, and does not close', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    useOrderHandlers({
      detail: cancelledFromReady,
      reply: async () => {
        await gate;
        return HttpResponse.json(reopened('ready'));
      },
    });
    const { user, onClose } = renderModal();

    await user.click(within(dialog()).getByRole('button', { name: 'Reopen Order' }));

    const pending = await within(dialog()).findByRole('button', { name: 'Reopening' });
    expect(pending).toHaveAttribute('aria-busy', 'true');
    expect(onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('sends one request for a double press', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const backend = useOrderHandlers({
      detail: cancelledFromReady,
      reply: async () => {
        await gate;
        return HttpResponse.json(reopened('ready'));
      },
    });
    const { user } = renderModal();
    const button = within(dialog()).getByRole('button', { name: 'Reopen Order' });

    await user.dblClick(button);
    release();

    await screen.findByText('Order reopened');
    expect(backend.writes).toHaveLength(1);
  });

  it('shows the server text in the window when the server refuses, and stays open', async () => {
    const detail = 'Reopen the order first, then cancel it.';
    useOrderHandlers({
      detail: cancelledFromReady,
      reply: () => refusal(422, 'orders.reopen-first', detail),
    });
    const { user, onClose } = renderModal();

    await user.click(within(dialog()).getByRole('button', { name: 'Reopen Order' }));

    expect(await within(dialog()).findByText(detail)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole('button', { name: 'Reopen Order' })).not.toHaveAttribute('aria-busy');
  });

  it('shows the P2 words, not server text, for a refusal that is not a 422', async () => {
    useOrderHandlers({ detail: order0148, reply: () => refusal(403, 'forbidden', 'secret server text') });
    const { user } = renderModal();

    await user.click(within(dialog()).getByRole('button', { name: 'Reopen Order' }));

    expect(await within(dialog()).findByText(/You don't have access to this/)).toBeVisible();
    expect(screen.queryByText('secret server text')).toBeNull();
  });
});
