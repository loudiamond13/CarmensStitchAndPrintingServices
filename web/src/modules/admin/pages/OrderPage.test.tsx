import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import OrderPage from '@/modules/admin/pages/OrderPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { staffBackend } from '@/test/expenseFixtures';
import {
  buildOrderDetail,
  cancelledOrderWithRefunds,
  completedOrder,
  creditOrder,
  order0148,
  order0151,
  orderProblem,
  orderRefund,
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
  useOrderHandlers();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

interface RenderOptions {
  order?: OrderDetailFixture;
  search?: string;
  /** The navigation state the page was opened with (the list card links send `{ from }`). */
  state?: unknown;
  /** Called with every URL write the nuqs adapter makes. */
  onUrlUpdate?: OnUrlUpdateFunction | undefined;
}

/**
 * Opens the order page in a data router, with the Orders list and the edit page as stand-ins to land on. The fake API answers
 * ORD-2026-0148 unless the test called useOrderHandlers({ detail }) first.
 */
function renderOrder({ order = order0148, search = '', state, onUrlUpdate }: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      { path: '/admin/orders', element: <p>The orders list</p> },
      { path: '/admin/orders/:id', element: <OrderPage /> },
      { path: '/admin/orders/:id/edit', element: <p>The edit page</p> },
    ],
    { initialEntries: [{ pathname: `/admin/orders/${order.id}`, search, state }] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        {...(onUrlUpdate === undefined ? {} : { onUrlUpdate })}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
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
    const walkIn = buildOrderDetail({ teamName: null });
    useOrderHandlers({ detail: walkIn });
    renderOrder({ order: walkIn });

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

    // The header link comes first; the customer card has one too.
    const [link] = await screen.findAllByRole('link', { name: 'Edit Details' });
    if (link === undefined) throw new Error('No Edit Details link');
    expect(link).toHaveAttribute('href', `/admin/orders/${order0148.id}/edit`);
    await userEvent.setup().click(link);
    await screen.findByText('The edit page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${order0148.id}/edit`);
  });

  it.each([
    ['Completed', completedOrder],
    ['Cancelled', cancelledOrderWithRefunds],
  ])('hides Edit Details on a %s order (D-15, D-39)', async (_status, order) => {
    useOrderHandlers({ detail: order });
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
    useOrderHandlers({ detail: creditOrder });
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

describe('the Payments tab on the page (ORD-07, D-09, D-12)', () => {
  it('shows the payments table with both people and the server balance in the caption', async () => {
    renderOrder({ search: '?tab=payments' });

    const table = await screen.findByRole('table', { name: 'Payments' });
    expect(within(table).getByText('Received by')).toBeVisible();
    expect(within(table).getByText('Recorded by')).toBeVisible();
    expect(within(table).getByText('9012 345 678901')).toBeVisible();
    expect(screen.getByText(/^Downpayments and settlements\./)).toHaveTextContent('Balance due: ₱9,327.50');
    expect(screen.queryByRole('table', { name: 'Order items' })).toBeNull();
  });
});

describe('the Discounts and Expenses tabs on the page (ORD-07)', () => {
  it('shows the discounts table for ?tab=discounts', async () => {
    renderOrder({ search: '?tab=discounts' });

    const table = await screen.findByRole('table', { name: 'Discounts' });
    expect(within(table).getByText('Barangay league discount')).toBeVisible();
    expect(within(table).getByText('Total discount').closest('tr')).toHaveTextContent('−₱1,122.50');
  });

  it('shows the expenses table for ?tab=expenses', async () => {
    renderOrder({ search: '?tab=expenses' });

    const table = await screen.findByRole('table', { name: 'Expenses' });
    expect(within(table).getByText('Dri-fit mesh, 45 yds')).toBeVisible();
    expect(within(table).getByText('Order expenses').closest('tr')).toHaveTextContent('₱6,065.00');
  });

  it('shows the inline empty line of a tab with no rows (UIC-4)', async () => {
    const bare = buildOrderDetail({ discounts: [] });
    useOrderHandlers({ detail: bare });
    renderOrder({ order: bare, search: '?tab=discounts' });

    expect(await screen.findByText('No discounts yet.')).toBeVisible();
  });
});

describe('the Refunds tab (ORD-07, D-13, UIC-35, UIC-46)', () => {
  it('is not drawn for an open order with no credit and no refunds', async () => {
    renderOrder();

    await screen.findByRole('tab', { name: /^Items/ });
    expect(screen.queryByRole('tab', { name: /^Refunds/ })).toBeNull();
  });

  it('is drawn with its count for an order that has refunds (UIC-35)', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderOrder({ order: cancelledOrderWithRefunds, search: '?tab=refunds' });

    const tab = await screen.findByRole('tab', { name: /^Refunds/ });
    expect(tab).toHaveTextContent('1');
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: 'Refunds' })).toBeVisible();
  });

  it('is drawn for an order with customer credit, with a zero count', async () => {
    useOrderHandlers({ detail: creditOrder });
    renderOrder({ order: creditOrder });

    expect(await screen.findByRole('tab', { name: /^Refunds/ })).toHaveTextContent('0');
  });

  it('is drawn for a Cancelled order with no refunds', async () => {
    const cancelled = buildOrderDetail({ status: 'cancelled' });
    useOrderHandlers({ detail: cancelled });
    renderOrder({ order: cancelled });

    expect(await screen.findByRole('tab', { name: /^Refunds/ })).toBeVisible();
  });

  it('replaces ?tab=refunds with items, in one replace, when the tab is not drawn (UIC-46)', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderOrder({ search: '?tab=refunds', onUrlUpdate });

    expect(await screen.findByRole('tab', { name: /^Items/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(
      onUrlUpdate.mock.calls.map(([event]) => ({ history: event.options.history, query: event.queryString })),
    ).toEqual([{ history: 'replace', query: '' }]);
    expect(screen.getByRole('table', { name: 'Order items' })).toBeVisible();
  });

  it('keeps ?tab=refunds when the tab is drawn', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderOrder({ order: cancelledOrderWithRefunds, search: '?tab=refunds', onUrlUpdate });

    await screen.findByRole('table', { name: 'Refunds' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe('the tab strip on a narrow screen (D-34)', () => {
  it('scrolls sideways inside itself while the page wrapper does not', async () => {
    const { container } = renderOrder();

    const strip = await screen.findByRole('tablist');
    expect(strip.className).toContain('overflow-x-auto');
    const page = container.firstElementChild;
    if (page === null) throw new Error('No page wrapper');
    expect(page.className).not.toContain('overflow-x');
    for (let node = strip.parentElement; node !== null && node !== container; node = node.parentElement) {
      expect(node.className).not.toContain('overflow-x-auto');
    }
  });
});

describe('the customer card (ORD-07, UIC-6)', () => {
  function customerCard(): HTMLElement {
    return screen.getByRole('region', { name: 'Customer' });
  }

  it('shows name, team, contact, email and address, and the order notes', async () => {
    renderOrder();

    await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    const card = customerCard();
    expect(within(card).getByText('Juan Dela Cruz')).toBeVisible();
    expect(within(card).getByText('Brgy. San Roque Ballers')).toBeVisible();
    expect(within(card).getByText('0917 123 4567')).toBeVisible();
    expect(within(card).getByText('juan.dc@example.ph')).toBeVisible();
    expect(within(card).getByText('Brgy. San Roque, Marikina City')).toBeVisible();
    expect(
      within(card).getByText('V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo.'),
    ).toBeVisible();
  });

  it('shows the empty value for a missing team, email and address, and hides the notes block', async () => {
    const sparse = buildOrderDetail({ teamName: null, email: null, address: null, notes: null });
    useOrderHandlers({ detail: sparse });
    renderOrder({ order: sparse });

    await screen.findByRole('heading', { level: 1, name: sparse.number });
    const card = customerCard();
    expect(within(card).getAllByText('Not set')).toHaveLength(3);
    expect(within(card).queryByText(/Captain wants/)).toBeNull();
  });

  it('links Edit Details to the edit page on an active order', async () => {
    renderOrder();

    await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    expect(within(customerCard()).getByRole('link', { name: 'Edit Details' })).toHaveAttribute(
      'href',
      `/admin/orders/${order0148.id}/edit`,
    );
  });

  it.each([
    ['Completed', completedOrder],
    ['Cancelled', cancelledOrderWithRefunds],
  ])('hides the Edit Details link on a %s order', async (_status, order) => {
    useOrderHandlers({ detail: order });
    renderOrder({ order });

    await screen.findByRole('heading', { level: 1, name: order.number });
    expect(within(customerCard()).queryByRole('link')).toBeNull();
  });
});

describe('the status history on the page (D-17)', () => {
  it('lists the newest change first', async () => {
    renderOrder();

    const card = await screen.findByRole('region', { name: 'Status history' });
    const [newest, oldest] = within(card).getAllByRole('listitem');
    expect(newest).toHaveTextContent('Pending to In Production');
    expect(oldest).toHaveTextContent('Created as Pending');
  });
});

describe('the phone balance card (D-33)', () => {
  it('sits between the header and the Images card, named by the server figures', async () => {
    renderOrder();

    const strip = await screen.findByRole('button', {
      name: 'Total ₱21,327.50, balance due ₱9,327.50. Show totals.',
    });
    const heading = screen.getByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    const images = screen.getByRole('heading', { level: 2, name: 'Images' });
    expect(heading.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.compareDocumentPosition(images) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('takes the person to the Totals heading', async () => {
    const user = userEvent.setup();
    renderOrder();

    await user.click(await screen.findByRole('button', { name: /Show totals\.$/ }));

    expect(screen.getByRole('heading', { level: 2, name: 'Totals' })).toHaveFocus();
  });
});

describe('the side column order (UI-SPEC block order)', () => {
  it('puts the totals, then the customer card, then the status history after the main column', async () => {
    renderOrder();

    const totals = await screen.findByRole('region', { name: 'Totals' });
    const customer = screen.getByRole('region', { name: 'Customer' });
    const history = screen.getByRole('region', { name: 'Status history' });
    const images = screen.getByRole('heading', { level: 2, name: 'Images' });
    expect(images.compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(totals.compareDocumentPosition(customer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(customer.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('accessibility (A11Y-01)', () => {
  it('has no axe violations', async () => {
    const { container } = renderOrder();

    await screen.findByRole('table', { name: 'Order items' });
    await expectNoAxeViolations(container);
  });
});

describe('loading, failure and not found (UIC-14, UIC-18, UIC-19)', () => {
  it('shows skeletons in a region named Loading order… on the first load', async () => {
    let release: (order: OrderDetailFixture) => void = () => undefined;
    useOrderHandlers({
      detail: () =>
        new Promise<OrderDetailFixture>((resolve) => {
          release = resolve;
        }),
    });
    const { container } = renderOrder();

    expect(await screen.findByText('Loading order…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(3);

    release(order0148);
    expect(await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' })).toBeVisible();
    expect(screen.getByText('Order loaded.')).toBeInTheDocument();
  });

  it("shows Couldn't load this order. with Try Again for a 500, and Try Again reads the order again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    useOrderHandlers({
      detail: () => {
        calls += 1;
        return calls === 1 ? orderProblem(500) : order0148;
      },
    });
    const { container } = renderOrder();

    expect(await screen.findByText("Couldn't load this order.")).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' })).toBeVisible();
    expect(screen.queryByText("Couldn't load this order.")).toBeNull();
    expect(calls).toBe(2);
  });

  it('shows This order was not found or was deleted. with Back to Orders for a 404', async () => {
    useOrderHandlers({ detail: () => orderProblem(404, 'orders.not-found') });
    const { container } = renderOrder();

    expect(await screen.findByText('This order was not found or was deleted.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Orders' })).toHaveAttribute('href', '/admin/orders');
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe('the back link (D-51, T-08-18)', () => {
  it('goes to the Orders list when the page was opened with no navigation state', async () => {
    renderOrder();

    expect(await screen.findByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/admin/orders');
  });

  it('goes back to the list as the user left it, with its filters, page and view', async () => {
    const from = '/admin/orders?status=delivered&page=2&view=table';
    const { router } = renderOrder({ state: { from } });

    const link = await screen.findByRole('link', { name: 'Orders' });
    expect(link).toHaveAttribute('href', from);
    await userEvent.setup().click(link);
    await screen.findByText('The orders list');
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(from);
  });

  it.each([
    ['a protocol-relative evil address', '//evil.example'],
    ['an address outside the admin area', '/admin/users'],
    ['a foreign address', 'https://evil.example/admin/orders'],
    ['an address that only starts like Orders', '/admin/ordersx'],
    ['an address outside the orders area, encoded', '/admin/%2e%2e/users'],
    ['a backslash address', '/admin/orders\\evil'],
    ['a value that is not text', 42],
  ])('sends %s to the Orders list (evil, outside)', async (_name, from) => {
    renderOrder({ state: { from } });

    expect(await screen.findByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/admin/orders');
  });

  it('keeps an order path under Orders, such as the deleted list', async () => {
    renderOrder({ state: { from: '/admin/orders/deleted?page=2' } });

    expect(await screen.findByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/admin/orders/deleted?page=2');
  });
});

describe('the document title (ORD-07)', () => {
  it('reads the order number once the order has loaded', async () => {
    renderOrder();

    await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    expect(document.title).toBe('ORD-2026-0148 · CSPS Admin');
  });
});

describe('the Change Status menu on the page (ORD-07, D-14, D-20)', () => {
  it('sits beside the status badge, outside the h1, on an active order', async () => {
    renderOrder();

    const heading = await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    const button = screen.getByRole('button', { name: 'Change Status' });
    expect(heading).not.toContainElement(button);
    expect(heading.parentElement).toContainElement(button);
    expect(heading.parentElement).toContainElement(screen.getByText('In Production'));
  });

  it('moves the order to Ready from the page: the badge changes and the history gains a row', async () => {
    const user = userEvent.setup();
    const moved = buildOrderDetail({
      status: 'ready',
      statusHistory: [
        ...order0148.statusHistory,
        { from: 'production', to: 'ready', changedAt: '2026-10-08T03:00:00Z', changedBy: order0148.recordedBy },
      ],
      version: 'AAAAAAAAB9F=',
    });
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(moved) });
    renderOrder();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Ready' }));

    expect(await screen.findByText('In Production to Ready')).toBeVisible();
    const heading = screen.getByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    expect(heading.parentElement).toHaveTextContent('Ready');
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Change Status' })).toHaveFocus();
  });
});

describe('a locked order and its banner (ORD-07, D-15, D-39, UIC-37)', () => {
  it.each([
    ['completed', completedOrder],
    ['cancelled', cancelledOrderWithRefunds],
  ] as const)('shows the %s banner with Reopen Order and no Change Status', async (status, order) => {
    useOrderHandlers({ detail: order });
    renderOrder({ order });

    await screen.findByRole('heading', { level: 1, name: order.number });
    expect(screen.getByText(`This order is ${status}.`)).toBeVisible();
    expect(screen.getByText('Reopen it to make changes.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reopen Order' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
  });

  it('adds the refunds line to the cancelled banner and keeps the Refunds tab', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderOrder({ order: cancelledOrderWithRefunds });

    await screen.findByRole('heading', { level: 1, name: cancelledOrderWithRefunds.number });
    expect(screen.getByText('Refunds can still be recorded on the Refunds tab.')).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Refunds/ })).toBeVisible();
  });

  it('shows the completed banner without the refunds line', async () => {
    useOrderHandlers({ detail: completedOrder });
    renderOrder({ order: completedOrder });

    await screen.findByRole('heading', { level: 1, name: completedOrder.number });
    expect(screen.queryByText('Refunds can still be recorded on the Refunds tab.')).toBeNull();
  });

  it('shows no banner on an active order', async () => {
    renderOrder();

    await screen.findByRole('heading', { level: 1, name: 'ORD-2026-0148' });
    expect(screen.queryByRole('button', { name: 'Reopen Order' })).toBeNull();
    expect(screen.queryByText(/^This order is (completed|cancelled)\.$/)).toBeNull();
  });

  it.each([
    ['Completed', completedOrder],
    ['Cancelled', cancelledOrderWithRefunds],
  ])('hides Edit Details, Add buttons and row actions on a locked %s order', async (_status, order) => {
    useOrderHandlers({ detail: order });
    renderOrder({ order });

    await screen.findByRole('heading', { level: 1, name: order.number });
    expect(screen.queryByRole('link', { name: 'Edit Details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Item' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit item/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete item/ })).toBeNull();
  });

  it('completes a settled order from the menu: the banner shows, the actions go, and Reopen Order has focus', async () => {
    const user = userEvent.setup();
    const completed = buildOrderDetail({
      ...order0151,
      status: 'completed',
      statusHistory: [
        ...order0151.statusHistory,
        { from: 'ready', to: 'completed', changedAt: '2026-10-08T03:00:00Z', changedBy: order0151.recordedBy },
      ],
      version: 'AAAAAAAAB9F=',
    });
    useOrderHandlers({ detail: order0151, reply: () => HttpResponse.json(completed) });
    renderOrder({ order: order0151 });

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mark Completed' }));

    expect(await screen.findByText('This order is completed.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reopen Order' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit Details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Item' })).toBeNull();
  });

  it('cancels an order from the menu: the banner and the Refunds tab show, and Reopen Order has focus', async () => {
    const user = userEvent.setup();
    const cancelled = buildOrderDetail({
      status: 'cancelled',
      statusHistory: [
        ...order0148.statusHistory,
        { from: 'production', to: 'cancelled', changedAt: '2026-10-08T03:00:00Z', changedBy: order0148.recordedBy },
      ],
      version: 'AAAAAAAAB9F=',
    });
    const backend = useOrderHandlers({ detail: order0148, reply: () => HttpResponse.json(cancelled) });
    renderOrder();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel Order' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel Order' }));

    expect(await screen.findByText('This order is cancelled.')).toBeVisible();
    expect(screen.getByText('Refunds can still be recorded on the Refunds tab.')).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Refunds/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reopen Order' })).toHaveFocus();
    expect(backend.writes).toHaveLength(1);
  });

  it('has no axe violations on the locked banner', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    const { container } = renderOrder({ order: cancelledOrderWithRefunds });

    await screen.findByText('This order is cancelled.');
    await expectNoAxeViolations(container);
  });
});

describe('reopening from the banner (ORD-07, D-15, D-16, UIC-37, UIC-47)', () => {
  const cancelledFromReady = buildOrderDetail({
    ...cancelledOrderWithRefunds,
    statusHistory: [
      { from: null, to: 'pending', changedAt: '2026-09-08T02:00:00Z', changedBy: order0148.recordedBy },
      { from: 'pending', to: 'ready', changedAt: '2026-09-12T02:00:00Z', changedBy: order0148.recordedBy },
      { from: 'ready', to: 'cancelled', changedAt: '2026-09-20T02:00:00Z', changedBy: order0148.recordedBy },
    ],
  });

  it('opens the Reopen window from the banner with the status before the end state chosen', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: cancelledFromReady });
    renderOrder({ order: cancelledFromReady });

    await user.click(await screen.findByRole('button', { name: 'Reopen Order' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reopen ORD-2026-0139' });
    expect(within(dialog).getByRole('radio', { name: 'Ready' })).toBeChecked();
  });

  it('reopens to the chosen status: the banner goes, the actions return and Change Status has focus', async () => {
    const user = userEvent.setup();
    const reopened = buildOrderDetail({
      ...cancelledFromReady,
      status: 'production',
      statusHistory: [
        ...cancelledFromReady.statusHistory,
        { from: 'cancelled', to: 'production', changedAt: '2026-10-08T03:00:00Z', changedBy: order0148.recordedBy },
      ],
      version: 'AAAAAAAAB9F=',
    });
    const backend = useOrderHandlers({ detail: cancelledFromReady, reply: () => HttpResponse.json(reopened) });
    renderOrder({ order: cancelledFromReady });

    await user.click(await screen.findByRole('button', { name: 'Reopen Order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reopen ORD-2026-0139' });
    await user.click(within(dialog).getByRole('radio', { name: 'In Production' }));
    await user.click(within(dialog).getByRole('button', { name: 'Reopen Order' }));

    const change = await screen.findByRole('button', { name: 'Change Status' });
    await waitFor(() => {
      expect(change).toHaveFocus();
    });
    expect(screen.queryByText('This order is cancelled.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reopen Order' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Edit Details' }).length).toBeGreaterThan(0);
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.body).toEqual({ status: 'production' });
  });

  it('keeps the order locked and puts focus back on Reopen Order when the window is cancelled', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: cancelledFromReady });
    renderOrder({ order: cancelledFromReady });

    await user.click(await screen.findByRole('button', { name: 'Reopen Order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reopen ORD-2026-0139' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Reopen Order' })).toHaveFocus();
    expect(screen.getByText('This order is cancelled.')).toBeVisible();
    expect(backend.writes).toHaveLength(0);
  });
});

describe('Record Refund from the credit block (ORD-18, D-19, UIC-34; plan 08-21)', () => {
  beforeEach(() => {
    staffBackend();
  });

  /** The order the server answers a refund of the whole credit with. */
  function creditCleared(): OrderDetailFixture {
    return buildOrderDetail({
      ...creditOrder,
      version: 'AAAAAAAAB9F=',
      refunds: [orderRefund('2026-10-08', 1000, 'Overpaid')],
      totals: { ...creditOrder.totals, refunded: 1000, customerCredit: 0, fullyPaid: true },
    });
  }

  it('shows Record Refund in the credit block and opens the window with the credit filled in', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: creditOrder });
    renderOrder({ order: creditOrder });

    await user.click(
      await within(await screen.findByRole('region', { name: 'Totals' })).findByRole('button', {
        name: 'Record Refund',
      }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Add Refund' });
    expect(within(dialog).getByRole('textbox', { name: /^Amount/ })).toHaveValue('1000.00');
    expect(within(dialog).getByLabelText(/^Date/)).toHaveValue('2026-10-08');
    expect(await within(dialog).findByRole('option', { name: 'Carmen Reyes (you)' })).toBeInTheDocument();
    expect(within(dialog).getByText('You can refund up to ₱1,000.00.')).toBeVisible();
  });

  it("clears the credit: the panel shows the server's Refunded row and Fully Paid, the toast follows D-05, focus goes to Totals", async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ detail: creditOrder, reply: () => HttpResponse.json(creditCleared()) });
    renderOrder({ order: creditOrder });

    await user.click(await screen.findByRole('button', { name: 'Record Refund' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Refund' });
    await within(dialog).findByRole('option', { name: 'Carmen Reyes (you)' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Overpaid');
    await user.click(within(dialog).getByRole('button', { name: 'Save Refund' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Refund' })).toBeNull();
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.path).toBe(`/orders/${creditOrder.id}/refunds`);
    expect(backend.writes[0]?.body).toMatchObject({ amount: 1000, reason: 'Overpaid' });
    expect(within(totalsPanel()).getByText('+₱1,000.00')).toBeVisible();
    expect(within(totalsPanel()).getByText('Fully Paid')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Record Refund' })).toBeNull();
    expect(screen.getByText('Refund added')).toBeVisible();
    expect(screen.getByText('Order is now fully paid.')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Totals' })).toHaveFocus();
    });
  });

  it('puts focus back on Record Refund when the window is cancelled', async () => {
    const user = userEvent.setup();
    useOrderHandlers({ detail: creditOrder });
    renderOrder({ order: creditOrder });

    await user.click(await screen.findByRole('button', { name: 'Record Refund' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Refund' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record Refund' })).toHaveFocus();
    });
  });

  it('hides Record Refund on a Completed order (D-19)', async () => {
    const completedWithCredit = buildOrderDetail({
      ...creditOrder,
      status: 'completed',
    });
    useOrderHandlers({ detail: completedWithCredit });
    renderOrder({ order: completedWithCredit });

    await screen.findByRole('heading', { level: 1, name: creditOrder.number });
    expect(within(totalsPanel()).getByText('Customer credit')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Record Refund' })).toBeNull();
  });
});
