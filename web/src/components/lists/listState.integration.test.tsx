import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { useListQuery } from '@/lib/query/useListQuery';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser, pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';
import { Select } from '@/components/forms';
import { FilterBar, Pagination, ResponsiveTable, SearchBox, type ResponsiveTableColumn } from '@/components/lists';

// WEB-10 end to end (plan 02-30; UI-SPEC "SPEC-GAP Primitive Specs" → Pagination, SearchBox, FilterBar, ResponsiveTable;
// research L-16, L-17; T-02-66). A demo Orders list built the way every list screen will be: one createListParams hook,
// its values passed through useSettledListParams(values, 300) (the typed search debounced, the page reset held with it)
// before useListQuery, the real FilterBar, SearchBox, Select,
// ResponsiveTable and Pagination, inside a real createBrowserRouter with the lazy UrlStateLayout (the nuqs adapter with
// the shared options and key order), against a fake API fetcher that records every request it receives. nuqs writes the browser
// history directly (shallow), so React Router's own location is not told (L-16): these tests read
// `window.location.search` and `window.history.length`, which is what refresh, a bookmark and Back read.

const useOrdersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(['all', 'ready', 'done'], 'all'),
});

interface OrdersPage {
  rows: { number: string; status: string }[];
  pageCount: number;
}

const COLUMNS: readonly ResponsiveTableColumn<OrdersPage['rows'][number]>[] = [
  { key: 'number', header: 'Order', lead: true, cell: (row) => row.number },
  { key: 'status', header: 'Status', cell: (row) => row.status },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'ready', label: 'Ready' },
  { value: 'done', label: 'Completed' },
] as const;

function isStatus(value: string): value is (typeof STATUS_OPTIONS)[number]['value'] {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

interface OrdersParams {
  page: number;
  size: number;
  q: string | null;
  status: string;
}

type Fetcher = (params: OrdersParams, signal: AbortSignal) => Promise<OrdersPage>;

function OrdersList({ fetcher }: { fetcher: Fetcher }) {
  const [values, set] = useOrdersListParams();
  const params = useSettledListParams(values, 300);
  const query = useListQuery({ key: 'orders', params, fetcher });
  return (
    <main>
      <h1 id="orders-results" tabIndex={-1}>
        Orders
      </h1>
      <FilterBar>
        <SearchBox value={values.q} placeholder="Order no., customer or team" onSearch={set.setSearch} />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={values.status}
          onChange={(event) => {
            if (isStatus(event.target.value)) {
              set.setFilter('status', event.target.value);
            }
          }}
        />
      </FilterBar>
      <ResponsiveTable
        caption="Orders"
        columns={COLUMNS}
        rows={query.data?.rows}
        rowKey={(row) => row.number}
        things="orders"
        pending={query.isPending}
        refetching={query.isPlaceholderData && query.isFetching}
        failed={query.isError}
        error={query.error}
      />
      <Pagination
        page={values.page}
        pageCount={query.data?.pageCount ?? 0}
        onPageChange={set.setPage}
        focusTargetId="orders-results"
        pageSize={values.size}
        onPageSizeChange={set.setPageSize}
      />
    </main>
  );
}

/** The request a list query sends: its parsed params as a query string, nulls left out (as the HTTP client does). */
function queryOf(params: OrdersParams): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null) {
      search.append(name, String(value));
    }
  }
  return `?${search.toString()}`;
}

interface FakeApi {
  /** The query string of every request, in order. */
  readonly calls: string[];
  readonly fetcher: Fetcher;
}

/** The fake API: page {page} of 5 holds two orders named after the parsed params it was asked for. */
function createFakeApi(): FakeApi {
  const calls: string[] = [];
  const fetcher: Fetcher = (params, signal) => {
    calls.push(queryOf(params));
    if (signal.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }
    const suffix = params.q === null ? '' : `-${params.q}`;
    return Promise.resolve({
      rows: [1, 2].map((n) => ({ number: `P${String(params.page)}-${String(n)}${suffix}`, status: params.status })),
      pageCount: 5,
    });
  };
  return { calls, fetcher };
}

function renderApp(): { client: QueryClient; fake: FakeApi; unmount: () => void } {
  const fake = createFakeApi();
  const client = createQueryClient();
  const routes: RouteObject[] = [
    {
      HydrateFallback: () => null,
      children: [
        {
          lazy: async () => ({ Component: (await import('@/lib/url-state/UrlStateLayout')).default }),
          children: [{ path: '/orders', element: <OrdersList fetcher={fake.fetcher} /> }],
        },
      ],
    },
  ];
  const router = createBrowserRouter(routes);
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, fake, unmount };
}

/** The query string of every request the fake API received, in order. */
function requested(fake: FakeApi): string[] {
  return fake.calls;
}

function orderNumbers(): string[] {
  const grid = screen.getByRole('table', { name: 'Orders' });
  return within(grid)
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td')?.textContent ?? '');
}

/** URL updates nuqs made (React Router's own initial replaceState carries no URL). */
function urlWrites(spy: { mock: { calls: unknown[][] } }): unknown[] {
  return spy.mock.calls.filter((call) => call[2] !== undefined).map((call) => call[2]);
}

describe('list state end to end in a data router (WEB-10, WEB-08)', () => {
  // nuqs patches window.history once, on its first mount, and marks it as patched. A spy installed before that mount
  // would be wrapped by the patch and then restored past it, leaving later tests without the patch, so the adapter is
  // mounted once here before any test spies on the history.
  beforeAll(async () => {
    window.history.replaceState(null, '', '/orders');
    const { unmount } = renderApp();
    expect(await screen.findByText('P1-1')).toBeInTheDocument();
    unmount();
  });

  beforeEach(() => {
    window.history.replaceState(null, '', '/orders');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites a hostile link once to the canonical URL and queries only the parsed values', async () => {
    window.history.replaceState(null, '', '/orders?status=bogus&page=0');
    const before = window.history.length;
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const pushState = vi.spyOn(window.history, 'pushState');
    const { client, fake } = renderApp();

    expect(await screen.findByText('P1-1')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(urlWrites(replaceState)).toHaveLength(1);
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
    expect(requested(fake)).toEqual(['?page=1&size=20&status=all']);
    expect(
      client
        .getQueryCache()
        .getAll()
        .map((cached) => cached.queryKey),
    ).toEqual([['orders', 'list', { page: 1, size: 20, q: null, status: 'all' }]]);
  });

  it('writes a typed search to the URL after 300 ms of quiet and fires one query for the settled text', async () => {
    window.history.replaceState(null, '', '/orders?page=2');
    const { client, fake } = renderApp();
    expect(await screen.findByText('P2-1')).toBeInTheDocument();
    const before = window.history.length;

    const search = screen.getByRole('searchbox', { name: 'Search' });
    const typedAt = Date.now();
    for (const text of ['j', 'je', 'jer', 'jers', 'jerse', 'jersey']) {
      fireEvent.change(search, { target: { value: text } });
    }
    expect(window.location.search).toBe('?page=2');

    await waitFor(() => {
      expect(window.location.search).toBe('?q=jersey');
    });
    expect(Date.now() - typedAt).toBeGreaterThanOrEqual(300);
    expect(await screen.findByText('P1-1-jersey')).toBeInTheDocument();
    expect(window.history.length).toBe(before);
    expect(requested(fake)).toEqual(['?page=2&size=20&status=all', '?page=1&size=20&q=jersey&status=all']);
    expect(
      client
        .getQueryCache()
        .getAll()
        .map((cached) => cached.queryKey[2]),
    ).toContainEqual({ page: 1, size: 20, q: 'jersey', status: 'all' });
    expect(search).toHaveValue('jersey');
  });

  it('replaces the history entry and resets the page on a filter change', async () => {
    window.history.replaceState(null, '', '/orders?page=3');
    renderApp();
    expect(await screen.findByText('P3-1')).toBeInTheDocument();
    const before = window.history.length;

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ready');

    await waitFor(() => {
      expect(window.location.search).toBe('?status=ready');
    });
    expect(await screen.findByText('P1-1')).toBeInTheDocument();
    expect(orderNumbers()).toEqual(['P1-1', 'P1-2']);
    expect(screen.getAllByText('ready')).toHaveLength(2);
    expect(window.history.length).toBe(before);
  });

  it('replaces the entry and resets the page on Rows per page', async () => {
    window.history.replaceState(null, '', '/orders?page=4');
    renderApp();
    expect(await screen.findByText('P4-1')).toBeInTheDocument();
    const before = window.history.length;

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');

    await waitFor(() => {
      expect(window.location.search).toBe('?size=50');
    });
    expect(window.history.length).toBe(before);
  });

  it('pushes a history entry on Next, moves focus to the results heading, and Back restores the previous rows', async () => {
    renderApp();
    expect(await screen.findByText('P1-1')).toBeInTheDocument();
    const before = window.history.length;

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(window.location.search).toBe('?page=2');
    });
    expect(window.history.length).toBe(before + 1);
    expect(screen.getByRole('heading', { name: 'Orders' })).toHaveFocus();
    expect(await screen.findByText('P2-1')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 5');

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    expect(await screen.findByText('P1-1')).toBeInTheDocument();
    expect(orderNumbers()).toEqual(['P1-1', 'P1-2']);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1 of 5');
  });
});
