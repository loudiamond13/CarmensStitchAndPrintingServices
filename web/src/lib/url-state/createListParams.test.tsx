import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createParser, parseAsStringLiteral } from 'nuqs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../query/queryClient';
import { useDebouncedValue } from '../query/useDebouncedValue';
import { useListQuery } from '../query/useListQuery';
import { createListParams } from './createListParams';
import { literalParser, pageParser, pageSizeParser, parseAsBusinessDate, searchParser } from './parsers';

/** A list with every kind of key a later list screen uses; `view` has no default on purpose (ORD-10). */
const useOrdersParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(['all', 'ready', 'done'], 'all'),
  sort: literalParser(['newest', 'due'], 'newest'),
  tab: literalParser(['items', 'payments'], 'items'),
  view: parseAsStringLiteral(['grid', 'table']),
  from: parseAsBusinessDate,
  to: parseAsBusinessDate,
});

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

/** Waits long enough for any queued nuqs URL update (rate limit 0 in the testing adapter) to flush. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function adapter(searchParams: string, onUrlUpdate: OnUrlUpdateFunction) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        {children}
      </NuqsTestingAdapter>
    );
  };
}

function renderOrders(searchParams = '') {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const view = renderHook(() => useOrdersParams(), { wrapper: adapter(searchParams, onUrlUpdate) });
  return { ...view, onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

async function expectSingleUpdate(
  onUrlUpdate: UrlUpdateSpy,
  expected: { history: 'push' | 'replace'; query: string },
): Promise<void> {
  await waitFor(() => {
    expect(onUrlUpdate).toHaveBeenCalled();
  });
  await settle();
  expect(updates(onUrlUpdate)).toEqual([expected]);
}

const DEFAULT_STATE = {
  page: 1,
  size: 20,
  q: null,
  status: 'all',
  sort: 'newest',
  tab: 'items',
  view: null,
  from: null,
  to: null,
};

describe('createListParams: an invalid URL is normalized once', () => {
  it('falls back to defaults for ?page=0&size=9999&status=bogus and removes them in one replace', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=0&size=9999&status=bogus');
    expect(result.current[0]).toEqual(DEFAULT_STATE);
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });

  it('reads every value as its default and writes nothing when there is no query string', async () => {
    const { result, onUrlUpdate } = renderOrders('');
    expect(result.current[0]).toEqual(DEFAULT_STATE);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('removes values equal to their defaults (?page=1&size=20&status=all) in one replace', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=1&size=20&status=all&sort=due');
    expect(result.current[0]).toMatchObject({ page: 1, size: 20, status: 'all', sort: 'due' });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?sort=due' });
  });

  it.each(['?page=-3', '?page=abc', '?page=2.5', '?page=1e3', '?page=%202', '?page=0x10'])(
    'treats %s as page 1 and removes it',
    async (search) => {
      const { result, onUrlUpdate } = renderOrders(search);
      expect(result.current[0].page).toBe(1);
      await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
    },
  );

  it('rejects ?from=2026-02-30 and removes it, but keeps a real calendar date', async () => {
    const bad = renderOrders('?from=2026-02-30');
    expect(bad.result.current[0].from).toBeNull();
    await expectSingleUpdate(bad.onUrlUpdate, { history: 'replace', query: '' });

    const good = renderOrders('?from=2026-02-28');
    expect(good.result.current[0].from).toBe('2026-02-28');
    await settle();
    expect(good.onUrlUpdate).not.toHaveBeenCalled();
  });

  it('treats a search of only spaces as no search and removes it', async () => {
    const { result, onUrlUpdate } = renderOrders('?q=%20%20%20');
    expect(result.current[0].q).toBeNull();
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });

  it('rewrites an untrimmed search to its trimmed form', async () => {
    const { result, onUrlUpdate } = renderOrders('?q=%20%20jersey%20');
    expect(result.current[0].q).toBe('jersey');
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?q=jersey' });
  });

  it('cuts a 101-character search in the URL to 100', async () => {
    const { result, onUrlUpdate } = renderOrders(`?q=${'x'.repeat(101)}`);
    expect(result.current[0].q).toBe('x'.repeat(100));
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: `?q=${'x'.repeat(100)}` });
  });

  it('normalizes every invalid key in the same single replace', async () => {
    const { onUrlUpdate } = renderOrders('?page=0&size=9999&status=bogus&sort=up&tab=x&view=list&from=2026-13-01&q=ok');
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?q=ok' });
  });

  it('rewrites at most once: a re-render, or arriving on the canonical URL, writes nothing more', async () => {
    const { rerender, onUrlUpdate } = renderOrders('?page=0&status=bogus&sort=due');
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?sort=due' });
    rerender();
    await settle();
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);

    const canonical = renderOrders('?sort=due');
    await settle();
    expect(canonical.onUrlUpdate).not.toHaveBeenCalled();
  });

  it('treats a parser that throws like an invalid value', async () => {
    const useThrowing = createListParams({
      page: pageParser,
      odd: createParser<string>({
        parse: () => {
          throw new Error('bad value');
        },
        serialize: (value) => value,
      }),
    });
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderHook(() => useThrowing(), { wrapper: adapter('?odd=1', onUrlUpdate) });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });
});

describe('createListParams: history and the page reset', () => {
  it('pushes a page change', async () => {
    const { result, onUrlUpdate } = renderOrders('?status=done');
    act(() => {
      result.current[1].setPage(2);
    });
    expect(result.current[0].page).toBe(2);
    await expectSingleUpdate(onUrlUpdate, { history: 'push', query: '?status=done&page=2' });
  });

  it('pushes a change back to page 1 and drops the default from the URL', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=3');
    act(() => {
      result.current[1].setPage(1);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'push', query: '' });
  });

  it.each([0, -2, 2.5, Number.NaN])('treats setPage(%d) as page 1', async (page) => {
    const { result, onUrlUpdate } = renderOrders('?page=3');
    act(() => {
      result.current[1].setPage(page);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'push', query: '' });
  });

  it('replaces on a filter change and resets the page in the same update', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=3');
    act(() => {
      result.current[1].setFilter('status', 'ready');
    });
    expect(result.current[0]).toMatchObject({ page: 1, status: 'ready' });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?status=ready' });
  });

  it('removes a filter set to its default or to null', async () => {
    const toDefault = renderOrders('?status=done&sort=due');
    act(() => {
      toDefault.result.current[1].setFilter('status', 'all');
    });
    await expectSingleUpdate(toDefault.onUrlUpdate, { history: 'replace', query: '?sort=due' });

    const toNull = renderOrders('?status=done&from=2026-10-01');
    act(() => {
      toNull.result.current[1].setFilter('from', null);
    });
    await expectSingleUpdate(toNull.onUrlUpdate, { history: 'replace', query: '?status=done' });
  });

  it('replaces on a page-size change and resets the page', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=3');
    act(() => {
      result.current[1].setPageSize(50);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?size=50' });
  });

  it.each([
    ['sort', 'due', '?sort=due'],
    ['tab', 'payments', '?tab=payments'],
    ['view', 'table', '?view=table'],
  ] as const)('a %s change replaces and resets the page', async (key, value, query) => {
    const { result, onUrlUpdate } = renderOrders('?page=4');
    act(() => {
      result.current[1].setFilter(key, value);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query });
  });

  it('setFilters changes several keys in one replace with the page reset', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=4&status=done');
    act(() => {
      result.current[1].setFilters({ from: '2026-10-01', to: '2026-10-07', status: null });
    });
    expect(result.current[0]).toMatchObject({ page: 1, status: 'all', from: '2026-10-01', to: '2026-10-07' });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?from=2026-10-01&to=2026-10-07' });
  });

  it('clampPage replaces a page past the last page with the last page', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=9');
    act(() => {
      result.current[1].clampPage(4);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?page=4' });
  });

  it('clampPage sends a page past an empty result (0 pages) to page 1', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=9');
    act(() => {
      result.current[1].clampPage(0);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });

  it.each([
    ['?page=2', 4],
    ['?page=4', 4],
    ['', 0],
  ] as const)('clampPage leaves %j alone when there are %i pages', async (search, totalPages) => {
    const { result, onUrlUpdate } = renderOrders(search);
    act(() => {
      result.current[1].clampPage(totalPages);
    });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reset clears every key in one replace', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=3&status=done&q=jersey');
    act(() => {
      result.current[1].reset();
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });
});

describe('createListParams: search', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function advance(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('writes a trimmed search after 300 ms of quiet and resets the page in the same replace', async () => {
    vi.useFakeTimers();
    const { result, onUrlUpdate } = renderOrders('?page=3');
    act(() => {
      result.current[1].setSearch('  jersey ');
    });
    expect(result.current[0]).toMatchObject({ q: 'jersey', page: 1 });
    await advance(299);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    await advance(51);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
  });

  it('sends one URL update for "jer" then "jersey" typed within 300 ms', async () => {
    vi.useFakeTimers();
    const { result, onUrlUpdate } = renderOrders('');
    act(() => {
      result.current[1].setSearch('jer');
    });
    await advance(200);
    act(() => {
      result.current[1].setSearch('jersey');
    });
    await advance(200);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    await advance(150);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
  });

  it('writes at once with { immediate: true } (Enter) and cancels a pending debounced write', async () => {
    vi.useFakeTimers();
    const { result, onUrlUpdate } = renderOrders('');
    act(() => {
      result.current[1].setSearch('jer');
    });
    await advance(100);
    act(() => {
      result.current[1].setSearch('jersey', { immediate: true });
    });
    await advance(10);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
    await advance(500);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
  });

  it('removes q when only spaces are typed', async () => {
    vi.useFakeTimers();
    const { result, onUrlUpdate } = renderOrders('?q=jersey');
    act(() => {
      result.current[1].setSearch('   ');
    });
    expect(result.current[0].q).toBeNull();
    await advance(350);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});

describe('createListParams: privacy (CWE-598)', () => {
  it.each([
    'email',
    'Email',
    'customerEmail',
    'phone',
    'mobile',
    'name',
    'customer_name',
    'token',
    'access-token',
    'password',
    'secret',
    'otp',
    'code',
  ])('refuses a list key named %j when the list is defined', (key) => {
    expect(() => createListParams({ page: pageParser, [key]: searchParser })).toThrow(/must not be a URL parameter/);
  });

  it('accepts ordinary list keys', () => {
    expect(() =>
      createListParams({ page: pageParser, q: searchParser, orderCode: searchParser, status: pageParser }),
    ).not.toThrow();
  });
});

// WEB-10 -> WEB-08: the parsed, defaulted list state is the only input of the 02-39 list query.
describe('createListParams with useListQuery', () => {
  type OrdersParams = ReturnType<typeof useOrdersParams>[0];
  type Fetcher = (params: OrdersParams, signal: AbortSignal) => Promise<{ rows: string[] }>;

  function OrdersList({ fetcher }: { fetcher: Fetcher }) {
    const [params] = useOrdersParams();
    const q = useDebouncedValue(params.q, 300);
    const query = useListQuery({ key: 'orders', params: { ...params, q }, fetcher });
    return <p>{query.data === undefined ? 'Loading' : query.data.rows.join(', ')}</p>;
  }

  function renderList(client: QueryClient, searchParams: string, fetcher: Fetcher) {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const view = render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
          <OrdersList fetcher={fetcher} />
        </NuqsTestingAdapter>
      </QueryClientProvider>,
    );
    return { ...view, onUrlUpdate };
  }

  it('keys and fetches only the parsed, defaulted values for a hostile URL, once', async () => {
    const client = createQueryClient();
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve({ rows: ['CSPS-0001'] }));

    const { onUrlUpdate } = renderList(client, '?page=0&size=9999&status=bogus', fetcher);

    expect(await screen.findByText('CSPS-0001')).toBeInTheDocument();
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(DEFAULT_STATE, expect.any(AbortSignal));
    expect(
      client
        .getQueryCache()
        .getAll()
        .map((cached) => cached.queryKey),
    ).toEqual([['orders', 'list', DEFAULT_STATE]]);
  });

  it('keys a valid URL on its parsed values', async () => {
    const client = createQueryClient();
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve({ rows: ['CSPS-0002'] }));

    renderList(client, '?page=2&size=50&q=jersey&status=ready', fetcher);

    expect(await screen.findByText('CSPS-0002')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      { ...DEFAULT_STATE, page: 2, size: 50, q: 'jersey', status: 'ready' },
      expect.any(AbortSignal),
    );
  });
});
