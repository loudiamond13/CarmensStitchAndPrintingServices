import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
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
  orderProblem,
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

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
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

describe('the list states (UIC-1, UIC-12, UIC-18)', () => {
  it('announces Loading orders… on the first load with 4 skeleton cards and a one-line subline, then shows the cards', async () => {
    useOrderHandlers({
      list: async () => {
        await delay(150);
        return standardOrderList();
      },
    });
    renderPage();

    expect(await screen.findByText('Loading orders…')).toBeInTheDocument();
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy?.firstElementChild?.children).toHaveLength(4);
    expect(screen.queryByRole('article')).toBeNull();
    // The subline is one skeleton line until the counts arrive.
    const head = screen.getByRole('heading', { level: 1, name: 'Orders' }).parentElement;
    expect(head?.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(1);

    await screen.findByText('148 orders · 37 active');
    expect(screen.queryByText('Loading orders…')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it("shows Couldn't load orders. with Try Again, and Try Again reads the list again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    useOrderHandlers({
      list: () => {
        calls += 1;
        return calls === 1 ? orderProblem(500) : standardOrderList();
      },
    });
    const view = renderPage();

    expect(await screen.findByText("Couldn't load orders.")).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByText('148 orders · 37 active');
    expect(screen.queryByText("Couldn't load orders.")).toBeNull();
    expect(calls).toBe(2);
  });

  it('shows No active orders with the D-55 words and New Order when the default view has no rows', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 0, active: 0 }) });
    const view = renderPage();

    expect(await screen.findByRole('heading', { name: 'No active orders' })).toBeVisible();
    expect(
      screen.getByText(
        'Orders in progress, and orders finished or cancelled in the last 30 days, show here. Older orders are under All statuses.',
      ),
    ).toBeVisible();
    // The header action and the first-use action.
    expect(screen.getAllByRole('link', { name: 'New Order' })).toHaveLength(2);
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByText('0 orders · 0 active')).toBeVisible();
    await expectNoAxeViolations(view.container);
  });

  it('reads 1 order · 1 active for a shop with one order', async () => {
    useOrderHandlers({ list: buildOrderList([listEntryOf(order0148)]) });
    renderPage();

    expect(await screen.findByText('1 order · 1 active')).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('keeps the cards and dims them by colour after 200 ms while the next page loads', async () => {
    const user = userEvent.setup();
    useOrderHandlers({
      list: async (url) => {
        if (url.searchParams.get('page') === '2') {
          await delay(700);
        }
        return buildOrderList([order0148, order0151].map(listEntryOf), {
          all: 148,
          active: 37,
          total: 45,
          page: Number(url.searchParams.get('page')),
        });
      },
    });
    renderPage();
    await screen.findByText('148 orders · 37 active');
    const grid = screen.getAllByRole('article')[0]?.parentElement;
    expect(grid).not.toHaveAttribute('data-refetching');

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(grid).not.toHaveAttribute('data-refetching');
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-refetching', 'true');
    });
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await waitFor(() => {
      expect(grid).not.toHaveAttribute('data-refetching');
    });
  });
});

describe('paging and rows per page (ORD-01, EDGE ORD-01 boundary)', () => {
  const MANY = (url: URL) =>
    buildOrderList([order0148, order0151, order0153].map(listEntryOf), {
      all: 148,
      active: 37,
      total: 45,
      page: Number(url.searchParams.get('page')),
      pageSize: Number(url.searchParams.get('pageSize')),
    });

  it('asks for the page and the size in the URL and shows Page 2 of 3', async () => {
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?page=2');

    await screen.findByText('148 orders · 37 active');
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({ page: '2', pageSize: '20' });
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
  });

  it('sends a size of 50 from the URL as pageSize 50', async () => {
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?size=50');

    await screen.findByText('148 orders · 37 active');
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({ page: '1', pageSize: '50' });
  });

  it('offers 10, 20, 50 and 100 rows per page', async () => {
    useOrderHandlers({ list: MANY });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    const select = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '20', '50', '100']);
    expect(select).toHaveValue('20');
  });

  it('a rows per page change asks for that size and goes back to page 1', async () => {
    const user = userEvent.setup();
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?page=2');

    await screen.findByText('148 orders · 37 active');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');

    await waitFor(() => {
      expect(Object.fromEntries(backend.lists.at(-1)?.searchParams ?? [])).toEqual({ page: '1', pageSize: '50' });
    });
  });

  it('Next pushes the next page into the URL and asks the server for it', async () => {
    const user = userEvent.setup();
    const updates: string[] = [];
    const backend = useOrderHandlers({ list: MANY });
    renderPage('', (event) => {
      updates.push(`${event.options.history}:${event.queryString}`);
    });

    await screen.findByText('148 orders · 37 active');
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
    });
    expect(updates).toContain('push:?page=2');
    expect(backend.lists.at(-1)?.searchParams.get('page')).toBe('2');
  });

  it('replaces a page past the last (?page=9 with 3 pages) with the last page', async () => {
    const updates: string[] = [];
    useOrderHandlers({ list: MANY });
    renderPage('?page=9', (event) => {
      updates.push(`${event.options.history}:${event.queryString}`);
    });

    await waitFor(() => {
      expect(updates).toContain('replace:?page=3');
    });
  });

  it('falls back from a size outside 10, 20, 50 and 100 with one replace and asks for the default', async () => {
    const updates: string[] = [];
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?size=33&page=0', (event) => {
      updates.push(`${event.options.history}:${event.queryString}`);
    });

    await screen.findByText('148 orders · 37 active');
    await waitFor(() => {
      expect(updates).toEqual(['replace:']);
    });
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({ page: '1', pageSize: '20' });
  });
});
