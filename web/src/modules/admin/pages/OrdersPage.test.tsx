import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import OrdersPage from '@/modules/admin/pages/OrdersPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderList,
  creditOrder,
  listEntryOf,
  order0148,
  order0151,
  order0153,
  standardOrderList,
  useOrderHandlers,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// L1 Orders, /admin/orders (ORD-01, ORD-11, ORD-12, ORD-19; plan 08-06): the server's rows as cards, with the server's
// figures, the list-wide counts in the subline and the due flag worked out from the response's own today.

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

/** Shows where the router went, and with what state, so a test can read a card link's target. */
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({ path: location.pathname, state: location.state as unknown })}
    </output>
  );
}

/** Where the router is now and the state the last navigation carried. */
function locationNow(): { path: string; state: unknown } {
  return JSON.parse(screen.getByTestId('location').textContent) as { path: string; state: unknown };
}

function renderPage(search = '') {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter initialEntries={[`/admin/orders${search}`]}>
          <OrdersPage />
          <LocationProbe />
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

function cardOf(number: string): HTMLElement {
  const card = screen
    .getAllByRole('article')
    .find((candidate) => within(candidate).queryByText(number, { exact: true }) !== null);
  if (card === undefined) {
    throw new Error(`No card for ${number}`);
  }
  return card;
}

describe('the page (ORD-01, D-41)', () => {
  it('shows the Orders heading, the title and the subline from the list-wide counts', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    expect(document.title).toBe('Orders · CSPS Admin');
    expect(await screen.findByText('148 orders · 37 active')).toBeVisible();
  });

  it('shows one card per row, in the order the server sent them', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    const numbers = screen.getAllByRole('article').map((card) => within(card).getByText(/^ORD-2026-/).textContent);
    expect(numbers).toEqual(['ORD-2026-0148', 'ORD-2026-0151', 'ORD-2026-0153', 'ORD-2026-0160']);
  });

  it('puts a Results heading above the cards so the card headings follow in order (D-54e)', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(screen.getByRole('heading', { level: 2, name: 'Results' })).toBeInTheDocument();
  });

  it('sends the page and the page size the server asked for and nothing else', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(backend.lists).toHaveLength(1);
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({ page: '1', pageSize: '20' });
  });
});

describe('the cards (ORD-01, ORD-12, D-04, D-40)', () => {
  it('shows Total, the piece count and the balance of ORD-2026-0148 as the server stored them', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    const card = cardOf('ORD-2026-0148');
    expect(within(card).getByText('48 pcs')).toBeVisible();
    expect(within(card).getByText('Total')).toBeVisible();
    expect(within(card).getByText('₱21,327.50')).toBeVisible();
    expect(within(card).getByText('Balance due')).toBeVisible();
    expect(within(card).getByText('₱9,327.50')).toBeVisible();
  });

  it('shows Fully Paid on ORD-2026-0151 (ORD-12)', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(within(cardOf('ORD-2026-0151')).getByText('Fully Paid')).toBeVisible();
  });

  it('shows a customer credit as a Credit badge', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(within(cardOf('ORD-2026-0160')).getByText('Credit ₱1,000.00')).toBeVisible();
  });

  it("shows ORD-2026-0153 as overdue by 3 days from the response's today, never the device clock (D-59)", async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    const card = cardOf('ORD-2026-0153');
    expect(within(card).getByText('Overdue by 3 days')).toBeVisible();
    expect(within(card).getByText('Due Oct 5, 2026')).toBeVisible();
  });

  it('shows the days left for an order due later', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(within(cardOf('ORD-2026-0148')).getByText('6 days left')).toBeVisible();
  });
});

describe('what the list never shows (ORD-19, D-06, D-20, D-22)', () => {
  it('never renders Order Expenses or Estimated Profit', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(screen.queryByText(/Order Expenses/i)).toBeNull();
    expect(screen.queryByText(/Estimated Profit/i)).toBeNull();
    expect(screen.queryByText(/Expenses/i)).toBeNull();
    expect(screen.queryByText(/Profit/i)).toBeNull();
  });

  it('gives a card no status change and no Delete', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    for (const card of screen.getAllByRole('article')) {
      const names = within(card)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
      expect(names.filter((name) => /status|delete/i.test(name))).toEqual([]);
    }
  });

  it('has no axe violations', async () => {
    useOrderHandlers({ list: standardOrderList() });
    const { container } = renderPage();

    await screen.findByText('148 orders · 37 active');
    await expectNoAxeViolations(container);
  });
});

describe('New Order and the card links (D-51)', () => {
  it('points New Order at /admin/orders/new', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(screen.getByRole('link', { name: 'New Order' })).toHaveAttribute('href', '/admin/orders/new');
  });

  it('opens the order with the current list search in the navigation state for the back link', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?size=50');

    await screen.findByText('148 orders · 37 active');
    await userEvent.click(within(cardOf('ORD-2026-0148')).getByRole('button', { name: 'View order ORD-2026-0148' }));

    expect(locationNow()).toEqual({
      path: `/admin/orders/${order0148.id}`,
      state: { from: '/admin/orders?size=50' },
    });
  });

  it('opens Edit Details of an order with the same back state', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    await userEvent.click(
      within(cardOf('ORD-2026-0151')).getByRole('button', { name: 'Edit details of order ORD-2026-0151' }),
    );

    expect(locationNow()).toEqual({
      path: `/admin/orders/${order0151.id}/edit`,
      state: { from: '/admin/orders' },
    });
  });
});

// Fixture sanity: the list rows are the detail fixtures' stored figures.
describe('the fixtures', () => {
  it('derive the list row from the detail', () => {
    const list = buildOrderList([order0153, creditOrder].map(listEntryOf), { all: 2, active: 2 });
    expect(list.items.map((item) => item.pieces)).toEqual([12, 10]);
  });
});
