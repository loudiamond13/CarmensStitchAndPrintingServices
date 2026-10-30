import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import OrderPage from '@/modules/admin/pages/OrderPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  creditOrder,
  order0148,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// O1 Order page, /admin/orders/:id (ORD-07, ORD-12, ORD-19; plan 08-10): the header, the totals panel with the internal
// figures, the Images card and the Items tab, all from the server's answer.

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

interface RenderOptions {
  order?: OrderDetailFixture;
  search?: string;
}

/** Opens the order page in a data router, with the Orders list and the edit page as stand-ins to land on. */
function renderOrder({ order = order0148, search = '' }: RenderOptions = {}) {
  useOrderHandlers({ detail: order });
  const router = createMemoryRouter(
    [
      { path: '/admin/orders', element: <p>The orders list</p> },
      { path: '/admin/orders/:id', element: <OrderPage /> },
      { path: '/admin/orders/:id/edit', element: <p>The edit page</p> },
    ],
    { initialEntries: [`/admin/orders/${order.id}${search}`] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <RouterProvider router={router} />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

/** The totals panel: the section named by the hidden Totals heading. */
function totalsPanel(): HTMLElement {
  return screen.getByRole('region', { name: 'Totals' });
}

describe('the header (ORD-07, D-46, D-36)', () => {
  it('shows the order number as the h1 with its status badge', async () => {
    renderOrder();

    expect(await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' })).toBeVisible();
    expect(screen.getByText('In Production')).toBeVisible();
  });

  it('reads team, customer, order date and the due flag from the response today', async () => {
    renderOrder();

    const subline = await screen.findByText(/Ordered Sep 28, 2026/);
    expect(subline).toHaveTextContent(
      'Brgy. San Roque Ballers · Juan Dela Cruz · Ordered Sep 28, 2026 · Due Oct 14, 2026 · 6 days left',
    );
  });

  it('names the customer first and says Walk-in customer when there is no team', async () => {
    renderOrder({ order: buildOrderDetail({ teamName: null }) });

    const subline = await screen.findByText(/Ordered Sep 28, 2026/);
    expect(subline).toHaveTextContent('Juan Dela Cruz · Walk-in customer · Ordered Sep 28, 2026');
  });

  it('shows who recorded the order and when', async () => {
    renderOrder();

    await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    const row = screen.getByText('Recorded by').closest('div');
    expect(row).toHaveTextContent('Carmen Reyes · Sep 28, 2026, 10:00 AM');
  });

  it('offers Edit Details to the edit page on an active order', async () => {
    const { router } = renderOrder();

    const link = await screen.findByRole('link', { name: 'Edit Details' });
    expect(link).toHaveAttribute('href', `/admin/orders/${order0148.id}/edit`);
    await userEvent.setup().click(link);
    await screen.findByText('The edit page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${order0148.id}/edit`);
  });

  it.each([
    ['Completed', completedOrder],
    ['Cancelled', cancelledOrderWithRefunds],
  ])('hides Edit Details on a %s order (D-15, D-39)', async (_status, order) => {
    renderOrder({ order });

    await screen.findByRole('heading', { level: 1, name: order.number });
    expect(screen.queryByRole('link', { name: 'Edit Details' })).toBeNull();
  });
});

describe('the totals panel (ORD-07, ORD-19, D-06, D-08)', () => {
  it.each(['Admin', 'Manager'] as const)(
    'shows the server figures with Order Expenses and Estimated Profit for a %s',
    async (role) => {
      acceptSession(
        sessionResponse({
          user: {
            id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
            email: 'carmen@example.ph',
            firstName: 'Carmen',
            lastName: 'Reyes',
            role,
          },
        }),
      );
      renderOrder();

      await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
      const panel = totalsPanel();
      expect(within(panel).getByText('Subtotal').nextSibling).toHaveTextContent('₱22,450.00');
      expect(within(panel).getByText('Discount').nextSibling).toHaveTextContent('−₱1,122.50');
      expect(within(panel).getByText('Total').nextSibling).toHaveTextContent('₱21,327.50');
      expect(within(panel).getByText('Paid').nextSibling).toHaveTextContent('−₱12,000.00');
      expect(within(panel).getByText('Balance due')).toBeVisible();
      expect(within(panel).getByText('₱9,327.50')).toBeVisible();
      expect(within(panel).getByText('Order Expenses').nextSibling).toHaveTextContent('₱6,065.00');
      expect(within(panel).getByText('Estimated Profit').nextSibling).toHaveTextContent('₱15,262.50');
    },
  );

  it('heads the panel with a hidden Totals heading that can take focus (D-33)', async () => {
    renderOrder();

    const heading = await screen.findByRole('heading', { level: 2, name: 'Totals' });
    expect(heading).toHaveAttribute('id', 'order-totals');
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('shows the customer credit block for an overpaid order', async () => {
    renderOrder({ order: creditOrder });

    await screen.findByRole('heading', { level: 1, name: creditOrder.number });
    expect(within(totalsPanel()).getByText('Customer credit')).toBeVisible();
  });
});

describe('the Images card (D-27)', () => {
  it('says image uploads are coming soon', async () => {
    renderOrder();

    expect(await screen.findByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
    expect(screen.getByText('Image uploads are coming soon.')).toBeVisible();
  });
});

describe('the Items tab (ORD-07)', () => {
  it('lists every item with its product type, description, size, quantity, unit price and line total', async () => {
    renderOrder();

    const table = await screen.findByRole('table', { name: 'Order items' });
    const rows = within(table).getAllByRole('row');
    // Header, five items and the footer.
    expect(rows).toHaveLength(7);
    const first = rows[1];
    if (first === undefined) throw new Error('No first item row');
    expect(within(first).getByText('Basketball Jersey')).toBeVisible();
    expect(within(first).getByText('Jersey top, sublimated, names and numbers')).toBeVisible();
    expect(within(first).getByText('S-XL')).toBeVisible();
    expect(within(first).getByText('15')).toBeVisible();
    expect(within(first).getByText('₱650.00')).toBeVisible();
    expect(within(first).getByText('₱9,750.00')).toBeVisible();
  });

  it('shows the empty value for an item with no size', async () => {
    renderOrder();

    const table = await screen.findByRole('table', { name: 'Order items' });
    const row = within(table).getByText('Team logo redraw and vector cleanup').closest('tr');
    if (row === null) throw new Error('No row for the logo item');
    expect(within(row).getByText('Not set')).toBeInTheDocument();
  });

  it('ends with the items subtotal and the piece count from the server figures', async () => {
    renderOrder();

    const table = await screen.findByRole('table', { name: 'Order items' });
    const footer = within(table).getByText('Items subtotal · 48 pcs').closest('tr');
    if (footer === null) throw new Error('No footer row');
    expect(footer).toHaveTextContent('₱22,450.00');
  });

  it('heads the tab with a title and its caption', async () => {
    renderOrder();

    expect(await screen.findByRole('heading', { level: 3, name: 'Order items' })).toBeVisible();
    expect(screen.getByText('Quantity × unit price. Changes update the total instantly.')).toBeVisible();
  });
});

describe('the tab card (ORD-07, WEB-10)', () => {
  it('names each tab with its count and starts on Items', async () => {
    renderOrder();

    const items = await screen.findByRole('tab', { name: /^Items/ });
    expect(items).toHaveAttribute('aria-selected', 'true');
    expect(items).toHaveTextContent('5');
    expect(screen.getByRole('tab', { name: /^Payments/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /^Discounts/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /^Expenses/ })).toHaveTextContent('3');
  });

  it('selects Payments for ?tab=payments', async () => {
    renderOrder({ search: '?tab=payments' });

    const payments = await screen.findByRole('tab', { name: /^Payments/ });
    expect(payments).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Items/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('table', { name: 'Order items' })).toBeNull();
  });

  it('falls back to Items for ?tab=bogus', async () => {
    renderOrder({ search: '?tab=bogus' });

    expect(await screen.findByRole('tab', { name: /^Items/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: 'Order items' })).toBeVisible();
  });
});

describe('accessibility (A11Y-01)', () => {
  it('has no axe violations', async () => {
    const { container } = renderOrder();

    await screen.findByRole('table', { name: 'Order items' });
    await expectNoAxeViolations(container);
  });
});
