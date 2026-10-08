import { act, renderHook, waitFor } from '@testing-library/react';
import { createParser, parseAsStringLiteral } from 'nuqs';
import { withNuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createListParams } from './createListParams';
import { orderSearchParams, URL_STATE_DEFAULTS } from './defaultOptions';
import { literalParser, pageSizeParser, parseAsBusinessDate, parseAsPage, parseAsSearch } from './parsers';

const useDemoParams = createListParams(
  {
    page: parseAsPage,
    pageSize: pageSizeParser,
    status: literalParser(['all', 'active', 'done'], 'all'),
  },
  { urlKeys: { pageSize: 'size' } },
);

/** A list with every kind of key a later list screen uses; `view` has no default on purpose (ORD-10). */
const useOrdersParams = createListParams({
  page: parseAsPage,
  pageSize: pageSizeParser,
  search: parseAsSearch,
  status: literalParser(['all', 'active', 'done'], 'all'),
  kind: literalParser(['any', 'jersey', 'tailoring'], 'any'),
  sort: literalParser(['newest', 'due'], 'newest'),
  tab: literalParser(['items', 'payments'], 'items'),
  view: parseAsStringLiteral(['grid', 'table']),
  from: parseAsBusinessDate,
});

/** Waits long enough for any queued nuqs URL update (rate limit 0 in the testing adapter) to flush. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

/** The app's adapter configuration (UrlStateLayout) on the nuqs testing adapter, with an in-memory URL. */
function wrapper(searchParams: string, onUrlUpdate: OnUrlUpdateFunction) {
  return withNuqsTestingAdapter({
    searchParams,
    onUrlUpdate,
    hasMemory: true,
    defaultOptions: URL_STATE_DEFAULTS,
    processUrlSearchParams: orderSearchParams,
  });
}

function renderOrders(searchParams = '') {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const view = renderHook(() => useOrdersParams(), { wrapper: wrapper(searchParams, onUrlUpdate) });
  return { ...view, onUrlUpdate };
}

function updates(onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

async function expectSingleUpdate(
  onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>,
  expected: { history: 'push' | 'replace'; query: string },
): Promise<void> {
  await waitFor(() => {
    expect(onUrlUpdate).toHaveBeenCalled();
  });
  await settle();
  expect(updates(onUrlUpdate)).toEqual([expected]);
}

describe('createListParams: normalize once', () => {
  it('falls back to defaults for ?size=9999&page=0&status=bogus and removes them in one replace', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { result } = renderHook(() => useDemoParams(), {
      wrapper: withNuqsTestingAdapter({ searchParams: '?size=9999&page=0&status=bogus', onUrlUpdate, hasMemory: true }),
    });

    expect(result.current[0]).toEqual({ page: 1, pageSize: 20, status: 'all' });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    });
    await settle();
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    const event = onUrlUpdate.mock.calls[0]?.[0];
    expect(event?.options.history).toBe('replace');
    expect(event?.queryString).toBe('');
  });

  it('reads every value as its default and writes nothing when there is no query string', async () => {
    const { result, onUrlUpdate } = renderOrders('');
    expect(result.current[0]).toEqual({
      page: 1,
      pageSize: 20,
      search: null,
      status: 'all',
      kind: 'any',
      sort: 'newest',
      tab: 'items',
      view: null,
      from: null,
    });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('removes values that equal their defaults (?page=1&size=20&status=all) in one replace', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=1&size=20&status=all&kind=jersey');
    expect(result.current[0]).toMatchObject({ page: 1, pageSize: 20, status: 'all', kind: 'jersey' });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?kind=jersey' });
  });

  it.each(['?page=-1', '?page=abc', '?page=2.5', '?page=1e3', '?page=%202', '?page=0x10'])(
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
    expect(result.current[0].search).toBeNull();
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });

  it('rewrites an untrimmed search to its trimmed form', async () => {
    const { result, onUrlUpdate } = renderOrders('?q=%20jersey%20');
    expect(result.current[0].search).toBe('jersey');
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?q=jersey' });
  });

  it('cuts a 101-character search in the URL to 100', async () => {
    const { result, onUrlUpdate } = renderOrders(`?q=${'x'.repeat(101)}`);
    expect(result.current[0].search).toBe('x'.repeat(100));
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: `?q=${'x'.repeat(100)}` });
  });

  it('normalizes every invalid key in the same single replace', async () => {
    const { onUrlUpdate } = renderOrders('?page=0&size=9999&status=bogus&sort=up&tab=x&view=list&from=2026-13-01&q=ok');
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?q=ok' });
  });

  it('rewrites the URL at most once: re-rendering with the normalized URL triggers no further update', async () => {
    const { rerender, onUrlUpdate } = renderOrders('?page=0&status=bogus&kind=jersey');
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?kind=jersey' });
    rerender();
    await settle();
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);

    const normalized = renderOrders('?kind=jersey');
    await settle();
    expect(normalized.onUrlUpdate).not.toHaveBeenCalled();
  });

  it('treats a parser that throws like an invalid value', async () => {
    const useThrowing = createListParams({
      page: parseAsPage,
      odd: createParser<string>({
        parse: () => {
          throw new Error('bad value');
        },
        serialize: (value) => value,
      }),
    });
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderHook(() => useThrowing(), { wrapper: wrapper('?odd=1', onUrlUpdate) });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '' });
  });
});

describe('createListParams: history and page reset', () => {
  it('pushes a page change', async () => {
    const { result, onUrlUpdate } = renderOrders('?status=done');
    act(() => {
      result.current[1].setPage(2);
    });
    expect(result.current[0].page).toBe(2);
    await expectSingleUpdate(onUrlUpdate, { history: 'push', query: '?page=2&status=done' });
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
      result.current[1].setFilter('status', 'done');
    });
    expect(result.current[0]).toMatchObject({ page: 1, status: 'done' });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?status=done' });
  });

  it('removes a filter set to its default or to null', async () => {
    const toDefault = renderOrders('?status=done&kind=jersey');
    act(() => {
      toDefault.result.current[1].setFilter('status', 'all');
    });
    await expectSingleUpdate(toDefault.onUrlUpdate, { history: 'replace', query: '?kind=jersey' });

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

  type Setters = ReturnType<typeof useOrdersParams>[1];
  it.each<[string, (setters: Setters) => void, string]>([
    [
      'setSort',
      (setters) => {
        setters.setSort('due');
      },
      '?sort=due',
    ],
    [
      'setTab',
      (setters) => {
        setters.setTab('payments');
      },
      '?tab=payments',
    ],
    [
      'setView',
      (setters) => {
        setters.setView('table');
      },
      '?view=table',
    ],
  ])('%s replaces and resets the page', async (_name, change, query) => {
    const { result, onUrlUpdate } = renderOrders('?page=4');
    act(() => {
      change(result.current[1]);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query });
  });

  it('clampPage replaces a page past the last page with the last page', async () => {
    const { result, onUrlUpdate } = renderOrders('?page=9');
    act(() => {
      result.current[1].clampPage(4);
    });
    await expectSingleUpdate(onUrlUpdate, { history: 'replace', query: '?page=4' });
  });

  it.each([
    ['?page=2', 4],
    ['?page=4', 4],
    ['?page=9', 0],
  ] as const)('clampPage leaves %s alone when the last page is %i', async (search, lastPage) => {
    const { result, onUrlUpdate } = renderOrders(search);
    act(() => {
      result.current[1].clampPage(lastPage);
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

  it('serializes keys in a fixed order (page, size, q, then the rest by name), whatever order they came in', async () => {
    const first = renderOrders('?status=done&kind=jersey&q=a');
    act(() => {
      first.result.current[1].setPage(2);
    });
    await expectSingleUpdate(first.onUrlUpdate, { history: 'push', query: '?page=2&q=a&kind=jersey&status=done' });

    const second = renderOrders('?q=a&kind=jersey&status=done');
    act(() => {
      second.result.current[1].setPage(2);
    });
    await expectSingleUpdate(second.onUrlUpdate, { history: 'push', query: '?page=2&q=a&kind=jersey&status=done' });
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
    expect(result.current[0]).toMatchObject({ search: 'jersey', page: 1 });
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

  it('removes the search when only spaces are typed', async () => {
    vi.useFakeTimers();
    const { result, onUrlUpdate } = renderOrders('?q=jersey');
    act(() => {
      result.current[1].setSearch('   ');
    });
    expect(result.current[0].search).toBeNull();
    await advance(350);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});

describe('createListParams: privacy (CWE-598)', () => {
  it.each([
    'email',
    'phone',
    'mobile',
    'name',
    'customerName',
    'token',
    'access_token',
    'password',
    'secret',
    'otp',
    'code',
  ])('refuses a list key whose URL name is %j', (key) => {
    expect(() => createListParams({ page: parseAsPage, [key]: parseAsSearch })).toThrow(TypeError);
  });

  it('refuses a URL key mapped to a personal-data name', () => {
    expect(() => createListParams({ search: parseAsSearch }, { urlKeys: { search: 'Email' } })).toThrow(
      /must not be a URL parameter/,
    );
  });
});
