import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { StatusBadge } from '@/components/status';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderStatusMenu } from '@/modules/admin/components/OrderStatusMenu';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { expectNoAxeViolations } from '@/test/axe';
import { buildOrderDetail, creditOrder, order0148, order0151, useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import type { OrderStatus } from '@/utils/csps';

// The Change Status menu (ORD-07, D-14, D-20, D-47; plan 08-19): a menu button by the status badge that lists the allowed moves,
// acts at once on a move, follows the APG menu-button keys, and shows a refusal as a danger toast with the server's words.

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

interface PageProps {
  id: string;
  onMoved?: ((answer: OrderDetailResponse) => void) | undefined;
}

/** The badge and the menu as the order page draws them: both read the order from the query, so a saved answer lands on them. */
function Page({ id, onMoved }: PageProps) {
  const query = useOrderQuery(id);
  const order = query.data;
  if (order === undefined) {
    return null;
  }
  return (
    <>
      <StatusBadge status={order.status as OrderStatus} />
      <OrderStatusMenu order={order} onMoved={onMoved} />
      <button type="button">Elsewhere</button>
    </>
  );
}

function renderMenu(order: OrderDetailResponse = order0148, onMoved?: PageProps['onMoved']) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Page id={order.id} onMoved={onMoved} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, ...view };
}

async function trigger(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Change Status' });
}

function menuLabels(): string[] {
  return within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((item) => item.textContent);
}

function refusal(status: number, code: string, detail: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

const readyAfterMove = buildOrderDetail({
  status: 'ready',
  statusChangedAt: '2026-10-08T03:00:00Z',
  statusHistory: [
    ...order0148.statusHistory,
    { from: 'production', to: 'ready', changedAt: '2026-10-08T03:00:00Z', changedBy: order0148.recordedBy },
  ],
  version: 'AAAAAAAAB9F=',
});

describe('the Change Status button and its menu (D-14, UIC-38)', () => {
  it('shows a Change Status button that is closed until it is pressed', async () => {
    useOrderHandlers({ detail: order0148 });
    renderMenu();

    const button = await trigger();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu named by the button when pressed', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();

    await user.click(await trigger());

    expect(screen.getByRole('menu', { name: 'Change Status' })).toBeVisible();
    expect(await trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists every other active status in order, then Mark Completed and Cancel Order', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();

    await user.click(await trigger());

    expect(menuLabels()).toEqual([
      'Move to Pending',
      'Move to Mockup',
      'Move to Ready',
      'Move to Delivered',
      'Mark CompletedBalance must be ₱0.00 to complete.',
      'Cancel Order',
    ]);
  });

  it('does not offer the status the order already has', async () => {
    useOrderHandlers({ detail: order0151 });
    const { user } = renderMenu(order0151);

    await user.click(await trigger());

    expect(screen.queryByRole('menuitem', { name: 'Move to Ready' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Move to In Production' })).toBeVisible();
  });

  it('disables Mark Completed with its visible reason while a balance is owed, and keeps it focusable', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();

    await user.click(await trigger());

    const item = screen.getByRole('menuitem', { name: /^Mark Completed/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(within(item).getByText('Balance must be ₱0.00 to complete.')).toBeVisible();
    item.focus();
    expect(item).toHaveFocus();
  });

  it('disables Mark Completed for a customer credit as well', async () => {
    useOrderHandlers({ detail: creditOrder });
    const { user } = renderMenu(creditOrder);

    await user.click(await trigger());

    expect(screen.getByRole('menuitem', { name: /^Mark Completed/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('offers Mark Completed, with no reason, when the balance is exactly 0.00', async () => {
    useOrderHandlers({ detail: order0151 });
    const { user } = renderMenu(order0151);

    await user.click(await trigger());

    const item = screen.getByRole('menuitem', { name: 'Mark Completed' });
    expect(item).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText('Balance must be ₱0.00 to complete.')).toBeNull();
  });

  it('shows Cancel Order in the danger text', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();

    await user.click(await trigger());

    expect(screen.getByRole('menuitem', { name: 'Cancel Order' })).toHaveClass('text-danger');
  });

  it('has no axe violations with the menu open', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user, container } = renderMenu();

    await user.click(await trigger());

    await expectNoAxeViolations(container);
  });
});

describe('the menu keys (UIC-56, APG menu button)', () => {
  it('opens on the first item with Enter', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();

    await user.keyboard('{Enter}');

    expect(screen.getByRole('menuitem', { name: 'Move to Pending' })).toHaveFocus();
  });

  it('opens on the first item with Space', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();

    await user.keyboard(' ');

    expect(screen.getByRole('menuitem', { name: 'Move to Pending' })).toHaveFocus();
  });

  it('opens on the first item with ArrowDown', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitem', { name: 'Move to Pending' })).toHaveFocus();
  });

  it('opens on the last item with ArrowUp', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('menuitem', { name: 'Cancel Order' })).toHaveFocus();
  });

  it('wraps the arrows from the last item to the first and back', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();
    await user.keyboard('{ArrowUp}');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Move to Pending' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Cancel Order' })).toHaveFocus();
  });

  it('moves to the first and the last item with Home and End', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');

    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Cancel Order' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Move to Pending' })).toHaveFocus();
  });

  it('reaches the disabled Mark Completed item with the arrows', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();
    await user.keyboard('{ArrowUp}{ArrowUp}');

    expect(screen.getByRole('menuitem', { name: /^Mark Completed/ })).toHaveFocus();
  });

  it('closes on Esc with focus back on the button', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();
    await user.keyboard('{ArrowDown}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(await trigger()).toHaveFocus();
    expect(await trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Tab and lets focus move on past the button', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    (await trigger()).focus();
    await user.keyboard('{ArrowDown}');

    await user.tab();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it('closes on a second press of the button', async () => {
    useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    await user.click(await trigger());

    await user.click(await trigger());

    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('moving the order (D-14, D-20, 05 D-21)', () => {
  it('posts the chosen status with an Idempotency-Key and no version, and the page shows the answer', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(readyAfterMove) });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <Page id={order0148.id} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeVisible();
    });
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe(`/orders/${order0148.id}/status`);
    expect(write?.body).toEqual({ status: 'ready' });
    expect(write?.body).not.toHaveProperty('version');
    expect(write?.key).toMatch(/\S/);
  });

  it('sends the wire key of In Production, which is production', async () => {
    const backend = useOrderHandlers({ detail: order0151, reply: () => HttpResponse.json(order0151) });
    const { user } = renderMenu(order0151);
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to In Production' }));

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toEqual({ status: 'production' });
  });

  it('toasts "Status changed" with the order number and the new status, and tells the page', async () => {
    useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(readyAfterMove) });
    const onMoved = vi.fn();
    const { user } = renderMenu(order0148, onMoved);
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    expect(await screen.findByText('Status changed')).toBeVisible();
    expect(screen.getByText('ORD-2026-0148 is now Ready.')).toBeVisible();
    expect(onMoved).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
  });

  it('closes the menu and puts focus on Change Status after a move', async () => {
    useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(readyAfterMove) });
    const { user } = renderMenu();
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    await screen.findByText('Status changed');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(await trigger()).toHaveFocus();
  });

  it('shows Saving on the trigger, keeping focus, while the move runs', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    useOrderHandlers({
      detail: order0148,
      reply: async () => {
        await gate;
        return HttpResponse.json(readyAfterMove);
      },
    });
    const { user } = renderMenu();
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    const saving = await screen.findByRole('button', { name: 'Saving' });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    expect(saving).toHaveFocus();
    release();
    expect(await screen.findByRole('button', { name: 'Change Status' })).not.toHaveAttribute('aria-busy');
  });

  it('shows a refusal as a danger toast with the server text and reads the order again (UIC-24)', async () => {
    const detail = 'This order still has ₱9,327.50 to pay. Record the payment first.';
    const backend = useOrderHandlers({
      detail: order0148,
      reply: () => refusal(422, 'orders.complete-balance-owed', detail),
    });
    const { user } = renderMenu();
    await user.click(await trigger());
    await waitFor(() => {
      expect(backend.reads).toHaveLength(1);
    });

    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    expect(await screen.findByText("Couldn't change the status")).toBeVisible();
    expect(screen.getByText(detail)).toBeVisible();
    await waitFor(() => {
      expect(backend.reads.length).toBeGreaterThan(1);
    });
    expect(await trigger()).toHaveFocus();
  });

  it('shows the P2 words, not server text, for a refusal that is not a 422', async () => {
    useOrderHandlers({ detail: order0148, reply: () => refusal(403, 'forbidden', 'secret server text') });
    const { user } = renderMenu();
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    expect(await screen.findByText(/You don't have access to this/)).toBeVisible();
    expect(screen.queryByText('secret server text')).toBeNull();
  });

  it('does nothing when a disabled Mark Completed is pressed, and keeps the menu open', async () => {
    const backend = useOrderHandlers({ detail: order0148 });
    const { user } = renderMenu();
    await user.click(await trigger());

    await user.click(screen.getByRole('menuitem', { name: /^Mark Completed/ }));

    expect(backend.writes).toHaveLength(0);
    expect(screen.getByRole('menu')).toBeVisible();
  });
});
