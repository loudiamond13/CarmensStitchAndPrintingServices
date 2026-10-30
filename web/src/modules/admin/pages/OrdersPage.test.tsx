import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import OrdersPage from '@/modules/admin/pages/OrdersPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderList,
  ORDER_TODAY,
  creditOrder,
  listEntryOf,
  orderProblem,
  order0148,
  order0151,
  order0153,
  standardOrderList,
  useOrderHandlers,
} from '@/test/orderFixtures';
import { BASKETBALL_ID } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { inStrictMode } from '@/test/strictMode';

// L1 Orders, /admin/orders (ORD-01, ORD-11, ORD-12, ORD-19; plan 08-06): the server's rows as cards, with the server's
// figures, the list-wide counts in the subline and the due flag worked out from the response's own today.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  window.localStorage.clear();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  window.localStorage.clear();
  vi.useRealTimers();
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
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({
      page: '1',
      pageSize: '20',
      sort: 'due',
      status: 'active',
    });
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
describe('the Deleted Orders link (ORD-06, D-23)', () => {
  it('shows a Manager a secondary Deleted Orders link to /admin/orders/deleted, before New Order', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    const deleted = screen.getByRole('link', { name: 'Deleted Orders' });
    expect(deleted).toHaveAttribute('href', '/admin/orders/deleted');
    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links.indexOf('Deleted Orders')).toBeLessThan(links.indexOf('New Order'));
  });

  it('shows an Admin no Deleted Orders link', async () => {
    acceptSession(
      sessionResponse({
        user: {
          id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
          email: 'lito@example.ph',
          firstName: 'Lito',
          lastName: 'Santos',
          role: 'Admin',
        },
      }),
    );
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(screen.queryByRole('link', { name: 'Deleted Orders' })).toBeNull();
    expect(screen.getByRole('link', { name: 'New Order' })).toBeVisible();
  });
});

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
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({
      page: '2',
      pageSize: '20',
      sort: 'due',
      status: 'active',
    });
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
  });

  it('sends a size of 50 from the URL as pageSize 50', async () => {
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?size=50');

    await screen.findByText('148 orders · 37 active');
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({
      page: '1',
      pageSize: '50',
      sort: 'due',
      status: 'active',
    });
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
      expect(Object.fromEntries(backend.lists.at(-1)?.searchParams ?? [])).toEqual({
        page: '1',
        pageSize: '50',
        sort: 'due',
        status: 'active',
      });
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
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({
      page: '1',
      pageSize: '20',
      sort: 'due',
      status: 'active',
    });
  });
});

/** The URL writes nuqs made, as history mode and query string. */
function urlWrites(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return spy.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('search (ORD-02, D-55, WEB-10)', () => {
  it('puts the search toolbar under the header, with the result bar and the hidden Results heading', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(screen.getByRole('search')).toContainElement(search);
    expect(search).toHaveAttribute('placeholder', 'Order no., customer, team or phone');
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 4 orders · sorted by due date');
    expect(screen.getByRole('heading', { level: 2, name: 'Results' })).toBeInTheDocument();
  });

  it('writes a typed search after 300 ms, asks the server once for the settled text and shows its chip', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('', onUrlUpdate);
    await screen.findByText('148 orders · 37 active');

    const search = screen.getByRole('searchbox', { name: 'Search' });
    for (const text of ['0', '01', '014', '0148']) {
      fireEvent.change(search, { target: { value: text } });
    }
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=0148' }]);
    });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.get('q')).toBe('0148');
    });
    expect(backend.lists.filter((url) => url.searchParams.has('q'))).toHaveLength(1);
    expect(await screen.findByText('Search: 0148')).toBeInTheDocument();
  });

  it('clearing the Search chip removes q from the URL and from the next request', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?q=0148', onUrlUpdate);
    await screen.findByText('Search: 0148');

    await userEvent.click(screen.getByRole('button', { name: 'Clear search filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Search: 0148')).toBeNull();
    });
    expect(urlWrites(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.has('q')).toBe(false);
    });
  });

  it('shows no chip and sends no q when nothing is searched (an empty search sends no q)', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(screen.queryByText(/^Search:/)).toBeNull();
    expect(backend.lists.every((url) => !url.searchParams.has('q'))).toBe(true);
  });

  it('sends a q of Pena Dela Cruz (with the tilde n) to the API as the same text (encoding edge)', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?q=Pe%C3%B1a%20Dela%20Cruz');

    expect(await screen.findByText('Search: Peña Dela Cruz')).toBeInTheDocument();
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.get('q')).toBe('Peña Dela Cruz');
    });
  });

  it('cuts a q of 101 characters to 100 before it reaches the API (boundary edge)', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage(`?q=${'a'.repeat(101)}`);

    await screen.findByText('148 orders · 37 active');
    expect(backend.lists.at(-1)?.searchParams.get('q')).toBe('a'.repeat(100));
  });

  it('keeps the list order the server sent when a search is on', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?q=ORD');

    await screen.findByText('Search: ORD');
    const numbers = (await screen.findAllByRole('article')).map(
      (card) => within(card).getByText(/^ORD-2026-/).textContent,
    );
    expect(numbers).toEqual(['ORD-2026-0148', 'ORD-2026-0151', 'ORD-2026-0153', 'ORD-2026-0160']);
  });
});

/** The query a list request carried, as plain text pairs. */
function queryOf(url: URL | undefined): Record<string, string> {
  return Object.fromEntries(url?.searchParams ?? []);
}

/** The list requests the page made for rows (the page size 1 requests are the business today probe). */
function rowRequests(urls: readonly URL[]): URL[] {
  return urls.filter((url) => url.searchParams.get('pageSize') !== '1');
}

describe('status, sort and balance reach the API (ORD-02, D-43)', () => {
  it('sends Active + recent and due date order by default, with no chip for either', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findByText('148 orders · 37 active');
    expect(queryOf(backend.lists[0])).toEqual({ page: '1', pageSize: '20', sort: 'due', status: 'active' });
    expect(screen.queryByText(/^Status:/)).toBeNull();
    expect(screen.queryByText(/^Sort:/)).toBeNull();
    expect(screen.queryByText('Has a balance')).toBeNull();
  });

  it('sends the status in the URL and shows its chip; the chip clears back to Active + recent', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?status=delivered', onUrlUpdate);

    expect(await screen.findByText('Status: Delivered')).toBeInTheDocument();
    expect(queryOf(backend.lists[0]).status).toBe('delivered');

    await userEvent.click(screen.getByRole('button', { name: 'Clear status filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Status: Delivered')).toBeNull();
    });
    expect(urlWrites(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    await waitFor(() => {
      expect(queryOf(backend.lists.at(-1)).status).toBe('active');
    });
  });

  it('names All statuses in its chip', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?status=all');

    expect(await screen.findByText('Status: All statuses')).toBeInTheDocument();
  });

  it.each([
    ['newest', 'newest first'],
    ['balance', 'balance'],
    ['total', 'total'],
  ])('sends sort=%s and the result bar says sorted by %s, with no chip for the sort', async (key, words) => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage(`?sort=${key}`);

    await screen.findByText('148 orders · 37 active');
    expect(queryOf(backend.lists[0]).sort).toBe(key);
    expect(screen.getByText(/^Showing/)).toHaveTextContent(`Showing 4 orders · sorted by ${words}`);
    expect(screen.queryAllByRole('button', { name: /^Clear .* filter$/ })).toHaveLength(0);
  });

  it('sends each sort the toolbar offers, in the order the server answers it', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('', onUrlUpdate);
    await screen.findByText('148 orders · 37 active');
    expect(queryOf(backend.lists[0]).sort).toBe('due');
    const sort = screen.getByRole('combobox', { name: 'Sort by' });

    for (const [label, key] of [
      ['Newest first', 'newest'],
      ['Balance (highest)', 'balance'],
      ['Total (highest)', 'total'],
    ] as const) {
      await userEvent.selectOptions(sort, label);
      await waitFor(() => {
        expect(queryOf(backend.lists.at(-1)).sort).toBe(key);
      });
    }
    // Back to the default: its answer is the first one, still held, so the page shows it again and the URL loses the key.
    await userEvent.selectOptions(sort, 'Due date (soonest)');
    await waitFor(() => {
      expect(urlWrites(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
    expect(sort).toHaveValue('due');
    const numbers = screen.getAllByRole('article').map((card) => within(card).getByText(/^ORD-2026-/).textContent);
    expect(numbers).toEqual(['ORD-2026-0148', 'ORD-2026-0151', 'ORD-2026-0153', 'ORD-2026-0160']);
  });

  it('sends hasBalance=true for the balance box, shows Has a balance and clears it with Clear balance filter', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?hasBalance=true', onUrlUpdate);

    expect(await screen.findByText('Has a balance')).toBeInTheDocument();
    expect(queryOf(backend.lists[0]).hasBalance).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Only orders with a balance' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Clear balance filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Has a balance')).toBeNull();
    });
    expect(urlWrites(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.has('hasBalance')).toBe(false);
    });
  });
});

describe('product type (ORD-02, T-08-16)', () => {
  it('sends the product type id and names it in the chip; Clear product filter removes it', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage(`?productType=${BASKETBALL_ID}`, onUrlUpdate);

    expect(await screen.findByText('Product: Basketball Jersey')).toBeInTheDocument();
    expect(queryOf(backend.lists[0]).productType).toBe(BASKETBALL_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Clear product filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Product: Basketball Jersey')).toBeNull();
    });
    expect(urlWrites(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
  });

  it('falls back to all products with one replace when the id is not in the list (a stale link)', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?productType=5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0fff', onUrlUpdate);

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.has('productType')).toBe(false);
    });
    expect(screen.queryByText(/^Product:/)).toBeNull();
  });
});

describe('order date presets use the server business today (D-59, ORD-02)', () => {
  it.each([
    ['30d', 'Last 30 days', '2026-09-09'],
    ['90d', 'Last 90 days', '2026-07-11'],
    ['month', 'This month', '2026-10-01'],
  ])('dates=%s asks the server for today first, then sends from and to for %s', async (key, words, from) => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage(`?dates=${key}`);

    expect(await screen.findByText(`Dates: ${words}`)).toBeInTheDocument();
    await waitFor(() => {
      expect(rowRequests(backend.lists)).toHaveLength(1);
    });
    expect(backend.lists[0]?.searchParams.get('pageSize')).toBe('1');
    expect(backend.lists[0]?.searchParams.has('from')).toBe(false);
    expect(queryOf(rowRequests(backend.lists)[0])).toEqual({
      page: '1',
      pageSize: '20',
      sort: 'due',
      status: 'active',
      from,
      to: ORDER_TODAY,
    });
    expect(await screen.findAllByRole('article')).toHaveLength(4);
  });

  it('shows the loading cards while the business today is not known yet', async () => {
    useOrderHandlers({
      list: async (url) => {
        if (url.searchParams.get('pageSize') === '1') {
          await delay(150);
        }
        return standardOrderList();
      },
    });
    renderPage('?dates=30d');

    expect(await screen.findByText('Loading orders…')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    expect(await screen.findAllByRole('article')).toHaveLength(4);
  });

  it('shows Try Again when the business today cannot be read, and Try Again asks again', async () => {
    let probes = 0;
    const backend = useOrderHandlers({
      list: (url) => {
        if (url.searchParams.get('pageSize') === '1') {
          probes += 1;
          return probes === 1 ? orderProblem(500) : standardOrderList();
        }
        return standardOrderList();
      },
    });
    renderPage('?dates=30d');

    expect(await screen.findByText("Couldn't load orders.")).toBeVisible();
    expect(rowRequests(backend.lists)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findAllByRole('article')).toHaveLength(4);
    expect(probes).toBe(2);
  });

  it.each([
    ['2026-10-08T23:30:00+08:00', 'late on the 8th'],
    ['2026-10-09T00:30:00+08:00', 'early on the 9th'],
  ])(
    'sends the same from and to for Last 30 days and This month at %s (%s) in Manila (precision edge)',
    async (instant) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(instant));
      const backend = useOrderHandlers({ list: standardOrderList() });
      const month = renderPage('?dates=month');
      await screen.findAllByRole('article');
      month.unmount();
      renderPage('?dates=30d');
      await screen.findAllByRole('article');

      const ranges = rowRequests(backend.lists).map(
        (url) => `${url.searchParams.get('from') ?? 'none'} to ${url.searchParams.get('to') ?? 'none'}`,
      );
      expect(ranges).toEqual(['2026-10-01 to 2026-10-08', '2026-09-09 to 2026-10-08']);
    },
  );
});

describe('a custom order date range (ORD-02, UIC-45)', () => {
  it('sends the pair as it is with no business today call, and shows it in the chip', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?dates=custom&from=2026-10-01&to=2026-10-31');

    expect(await screen.findByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
    await screen.findAllByRole('article');
    expect(backend.lists).toHaveLength(1);
    expect(queryOf(backend.lists[0])).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-31');
  });

  it('applies From equal to To as a one-day range', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?dates=custom&from=2026-10-05&to=2026-10-05');

    expect(await screen.findByText('Dates: Oct 5, 2026 to Oct 5, 2026')).toBeInTheDocument();
    expect(queryOf(backend.lists[0])).toMatchObject({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('Clear dates filter removes dates, from and to with one replace', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?dates=custom&from=2026-10-01&to=2026-10-31', onUrlUpdate);
    await screen.findByText('Dates: Oct 1, 2026 to Oct 31, 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Clear dates filter' }));

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.has('from')).toBe(false);
    });
    expect(screen.queryByText(/^Dates:/)).toBeNull();
  });

  it('drops a broken pair (From after To) with one replace and never sends it', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?dates=custom&from=2026-10-31&to=2026-10-01', onUrlUpdate);

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    await screen.findAllByRole('article');
    expect(backend.lists.some((url) => url.searchParams.has('from') || url.searchParams.has('to'))).toBe(false);
    expect(screen.queryByText(/^Dates:/)).toBeNull();
  });

  it('drops dates=custom with a missing date with one replace', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?dates=custom&from=2026-10-01', onUrlUpdate);

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
  });

  it('keeps the last applied range while the typed range is not valid', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?dates=custom&from=2026-10-01&to=2026-10-31', onUrlUpdate);
    await screen.findByText('Dates: Oct 1, 2026 to Oct 31, 2026');
    const requests = backend.lists.length;

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-15' } });

    expect(await screen.findByText("The end date can't be before the start date.")).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(backend.lists).toHaveLength(requests);
    expect(screen.getByText('Dates: Oct 1, 2026 to Oct 31, 2026')).toBeInTheDocument();
  });
});

describe('a filter change keeps the rows and goes back to page 1 (ORD-02, UIC-13, EDGE adjacency)', () => {
  const MANY = (url: URL) =>
    buildOrderList([order0148, order0151, order0153].map(listEntryOf), {
      all: 148,
      active: 37,
      total: 45,
      page: Number(url.searchParams.get('page')),
      pageSize: Number(url.searchParams.get('pageSize')),
    });

  it('Status Delivered on page 3 makes one replace that drops the page, then asks for page 1', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?page=3&size=10', onUrlUpdate);
    await screen.findByText('148 orders · 37 active');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Delivered');

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=10&status=delivered' }]);
    });
    await waitFor(() => {
      expect(queryOf(backend.lists.at(-1))).toMatchObject({ page: '1', pageSize: '10', status: 'delivered' });
    });
  });

  it('a page change pushes, so Back returns to the page before', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    useOrderHandlers({ list: MANY });
    renderPage('?status=delivered', onUrlUpdate);
    await screen.findByText('148 orders · 37 active');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2&status=delivered' }]);
    });
  });

  it('keeps the rows and dims them after 200 ms while a filter loads', async () => {
    useOrderHandlers({
      list: async (url) => {
        if (url.searchParams.get('status') === 'delivered') {
          await delay(700);
        }
        return standardOrderList();
      },
    });
    renderPage();
    await screen.findByText('148 orders · 37 active');
    const grid = screen.getAllByRole('article')[0]?.parentElement;
    expect(grid).not.toHaveAttribute('data-refetching');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Delivered');

    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(grid).not.toHaveAttribute('data-refetching');
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-refetching', 'true');
    });
    expect(screen.getAllByRole('article')).toHaveLength(4);
    await waitFor(() => {
      expect(grid).not.toHaveAttribute('data-refetching');
    });
  });

  it('has no axe violations with every filter on', async () => {
    useOrderHandlers({ list: standardOrderList() });
    const view = renderPage(
      `?q=ball&status=delivered&dates=custom&from=2026-10-01&to=2026-10-31&hasBalance=true&productType=${BASKETBALL_ID}&sort=total`,
    );

    await screen.findByText('Product: Basketball Jersey');
    await screen.findAllByRole('article');
    await expectNoAxeViolations(view.container);
  });
});

describe('no matches and Clear Filters (UIC-2, ORD-02)', () => {
  const EVERY_FILTER = `?size=50&sort=newest&q=zzz&status=delivered&dates=custom&from=2026-10-01&to=2026-10-31&productType=${BASKETBALL_ID}&hasBalance=true`;

  /** Rows only when no filter is on; a filtered request finds nothing. */
  const emptyWhenFiltered = (url: URL) =>
    ['q', 'from', 'hasBalance', 'productType'].some((key) => url.searchParams.has(key)) ||
    url.searchParams.get('status') !== 'active'
      ? buildOrderList([], { all: 148, active: 37 })
      : standardOrderList();

  it('shows No matches naming the search and the status, not the first-use state, for a search with no rows', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 148, active: 37 }) });
    renderPage('?q=zzz');

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeVisible();
    expect(
      screen.getByText('No orders match “zzz” with status Active + recent. Try another search or clear the filters.'),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'No active orders' })).toBeNull();
    expect(screen.getByText('Search: zzz')).toBeInTheDocument();
  });

  it('shows No matches with the filters message when there is no search text', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 148, active: 37 }) });
    renderPage('?status=delivered&hasBalance=true');

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeVisible();
    expect(
      screen.getByText('No orders with status Delivered and a balance. Try another search or clear the filters.'),
    ).toBeVisible();
  });

  it('names the dates and the product type in the message', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 148, active: 37 }) });
    renderPage(`?dates=custom&from=2026-10-01&to=2026-10-31&productType=${BASKETBALL_ID}`);

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeVisible();
    expect(
      screen.getByText(
        'No orders with status Active + recent, dates Oct 1, 2026 to Oct 31, 2026 and product Basketball Jersey. Try another search or clear the filters.',
      ),
    ).toBeVisible();
  });

  it('still shows the first-use state when only the sort is changed and there are no rows', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 0, active: 0 }) });
    renderPage('?sort=newest');

    expect(await screen.findByRole('heading', { name: 'No active orders' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'No matches' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull();
  });

  it('shows no Clear Filters button while there are rows', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?q=ORD');

    await screen.findAllByRole('article');
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull();
  });

  it('Clear Filters clears the search and every filter in one replace and keeps the sort and the rows per page', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: emptyWhenFiltered });
    renderPage(EVERY_FILTER, onUrlUpdate);
    await screen.findByRole('heading', { name: 'No matches' });
    const writesBefore = urlWrites(onUrlUpdate).length;

    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(await screen.findAllByRole('article')).toHaveLength(4);
    expect(urlWrites(onUrlUpdate).slice(writesBefore)).toEqual([{ history: 'replace', query: '?size=50&sort=newest' }]);
    expect(screen.queryByText(/^(Search|Status|Dates|Product):/)).toBeNull();
    expect(screen.queryByText('Has a balance')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('newest');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('active');
    expect(screen.getByRole('checkbox', { name: 'Only orders with a balance' })).not.toBeChecked();
    expect(queryOf(backend.lists.at(-1))).toEqual({ page: '1', pageSize: '50', sort: 'newest', status: 'active' });
  });

  it('has no axe violations in the No matches state', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 148, active: 37 }) });
    const view = renderPage('?q=zzz&status=delivered');

    await screen.findByRole('heading', { name: 'No matches' });
    await expectNoAxeViolations(view.container);
  });
});

describe('the view switch (ORD-10, UIC-30; plan 08-11)', () => {
  const MANY = (url: URL) =>
    buildOrderList([order0148, order0151, order0153].map(listEntryOf), {
      all: 148,
      active: 37,
      total: 45,
      page: Number(url.searchParams.get('page')),
      pageSize: Number(url.searchParams.get('pageSize')),
    });

  it('offers an icon-only View switch named Grid view and Table view, with the grid selected by default', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    await screen.findAllByRole('article');
    const group = screen.getByRole('radiogroup', { name: 'View' });
    const grid = within(group).getByRole('radio', { name: 'Grid view' });
    const table = within(group).getByRole('radio', { name: 'Table view' });
    expect(grid).toBeChecked();
    expect(table).not.toBeChecked();
    expect(grid).toHaveAttribute('title', 'Grid view');
    expect(table).toHaveAttribute('title', 'Table view');
    expect(grid).toHaveTextContent('');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the table, not the cards, for ?view=table', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=table');

    expect(await screen.findByRole('table', { name: 'Orders' })).toBeVisible();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked();
    expect(screen.getByRole('columnheader', { name: 'Order' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      '/admin/orders/00000000-0000-4000-8000-000000000148',
    );
  });

  it('shows the table for a stored table choice when the URL has no view', async () => {
    window.localStorage.setItem('csps-orders-view', 'table');
    useOrderHandlers({ list: standardOrderList() });
    renderPage();

    expect(await screen.findByRole('table', { name: 'Orders' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked();
  });

  it('shows the grid for ?view=grid whatever is stored', async () => {
    window.localStorage.setItem('csps-orders-view', 'table');
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=grid');

    expect(await screen.findAllByRole('article')).toHaveLength(4);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Table view switches with one replace, keeps page 2 and remembers the choice', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const backend = useOrderHandlers({ list: MANY });
    renderPage('?page=2', onUrlUpdate);
    await screen.findAllByRole('article');

    await userEvent.click(screen.getByRole('radio', { name: 'Table view' }));

    expect(await screen.findByRole('table', { name: 'Orders' })).toBeVisible();
    expect(urlWrites(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=2&view=table' }]);
    expect(window.localStorage.getItem('csps-orders-view')).toBe('table');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 3');
    expect(rowRequests(backend.lists).every((url) => url.searchParams.get('page') === '2')).toBe(true);
  });

  it('a visit with ?view=table writes nothing to the storage', async () => {
    window.localStorage.setItem('csps-orders-view', 'grid');
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=table');

    await screen.findByRole('table', { name: 'Orders' });
    expect(window.localStorage.getItem('csps-orders-view')).toBe('grid');
  });

  it('pressing the view already shown writes nothing new', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    useOrderHandlers({ list: standardOrderList() });
    renderPage('', onUrlUpdate);
    await screen.findAllByRole('article');

    await userEvent.click(screen.getByRole('radio', { name: 'Grid view' }));

    expect(urlWrites(onUrlUpdate)).toEqual([]);
    expect(window.localStorage.getItem('csps-orders-view')).toBeNull();
  });

  it('does not send the view to the API and keeps the same rows request', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=table');

    await screen.findByRole('table', { name: 'Orders' });
    expect(queryOf(backend.lists[0])).toEqual({ page: '1', pageSize: '20', sort: 'due', status: 'active' });
  });
});

describe('the table view states and links (ORD-01, D-51, UIC-1, UIC-2; plan 08-11)', () => {
  it('announces Loading orders… on the first load with a skeleton table of 4 rows, then shows the rows', async () => {
    useOrderHandlers({
      list: async () => {
        await delay(150);
        return standardOrderList();
      },
    });
    renderPage('?view=table');

    expect(await screen.findByText('Loading orders…')).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByRole('link', { name: /^ORD-/ })).toBeNull();

    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
    expect(screen.queryByText('Loading orders…')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });

  it('shows the same rows, in the order the server sent them', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=table');

    await screen.findByRole('table', { name: 'Orders' });
    const numbers = screen.getAllByRole('link', { name: /^ORD-2026-/ }).map((link) => link.textContent);
    expect(numbers).toEqual(['ORD-2026-0148', 'ORD-2026-0151', 'ORD-2026-0153', 'ORD-2026-0160']);
  });

  it('opens an order from its number with the current list address in the navigation state (D-51)', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?size=50&view=table');

    await userEvent.click(await screen.findByRole('link', { name: 'ORD-2026-0148' }));

    expect(locationNow()).toEqual({
      path: `/admin/orders/${order0148.id}`,
      state: { from: '/admin/orders?size=50&view=table' },
    });
  });

  it('opens the order from the View row action with the same back state', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=table');

    await userEvent.click(await screen.findByRole('button', { name: 'View order ORD-2026-0151' }));

    expect(locationNow()).toEqual({
      path: `/admin/orders/${order0151.id}`,
      state: { from: '/admin/orders?view=table' },
    });
  });

  it('opens Edit Details from the Edit row action with the same back state', async () => {
    useOrderHandlers({ list: standardOrderList() });
    renderPage('?view=table');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit details of order ORD-2026-0153' }));

    expect(locationNow()).toEqual({
      path: `/admin/orders/${order0153.id}/edit`,
      state: { from: '/admin/orders?view=table' },
    });
  });

  it("shows Couldn't load orders. with Try Again, and Try Again reads the list again", async () => {
    let calls = 0;
    useOrderHandlers({
      list: () => {
        calls += 1;
        return calls === 1 ? orderProblem(500) : standardOrderList();
      },
    });
    renderPage('?view=table');

    expect(await screen.findByText("Couldn't load orders.")).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
    expect(calls).toBe(2);
  });

  it('shows No active orders with New Order when the default view has no rows', async () => {
    useOrderHandlers({ list: buildOrderList([], { all: 0, active: 0 }) });
    renderPage('?view=table');

    expect(await screen.findByRole('heading', { name: 'No active orders' })).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'New Order' }).length).toBeGreaterThan(0);
  });

  it('shows No matches for a search with no rows, and Clear Filters keeps the table view', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    useOrderHandlers({
      list: (url) => (url.searchParams.has('q') ? buildOrderList([], { all: 148, active: 37 }) : standardOrderList()),
    });
    renderPage('?view=table&q=zzz', onUrlUpdate);

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(await screen.findByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
    expect(urlWrites(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '?view=table' });
    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked();
  });

  it('keeps the rows and goes back to page 1 when a filter changes in the table view', async () => {
    const backend = useOrderHandlers({
      list: (url) =>
        buildOrderList([order0148, order0151].map(listEntryOf), {
          all: 148,
          active: 37,
          total: 45,
          page: Number(url.searchParams.get('page')),
          pageSize: Number(url.searchParams.get('pageSize')),
        }),
    });
    renderPage('?view=table&page=3');
    await screen.findByRole('table', { name: 'Orders' });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Delivered');

    await waitFor(() => {
      expect(queryOf(backend.lists.at(-1))).toMatchObject({ page: '1', status: 'delivered' });
    });
    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked();
  });

  it('has no axe violations in the table view', async () => {
    useOrderHandlers({ list: standardOrderList() });
    const view = renderPage('?view=table');

    await screen.findByRole('table', { name: 'Orders' });
    await expectNoAxeViolations(view.container);
  });
});

describe('under StrictMode', () => {
  it('draws the page and its cards, whether the render is cached or fresh', async () => {
    useOrderHandlers({ list: standardOrderList() });
    await inStrictMode(async () => {
      renderPage();

      expect(await screen.findByText('148 orders · 37 active')).toBeVisible();
    });
  });
});
