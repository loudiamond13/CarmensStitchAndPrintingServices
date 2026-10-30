import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { resolveRangePreset } from '@/lib/url-state/parsers';
import {
  ORDER_DATE_RANGES,
  ORDER_SORTS,
  ORDER_STATUS_FILTERS,
  resolveOrderDateRange,
  useOrdersListParams,
} from './useOrdersListParams';

// The Orders list keeps its view in the URL (ORD-01, ORD-02, WEB-10, T-08-08, T-08-16, T-08-17; plans 08-06 and 08-09).

const DEFAULTS = {
  page: 1,
  size: 20,
  q: null,
  status: 'active',
  dates: null,
  from: null,
  to: null,
  productType: null,
  hasBalance: null,
  sort: 'due',
};
const PRODUCT_ID = '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0001';

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function renderParams(searchParams = '') {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter
      searchParams={searchParams}
      onUrlUpdate={onUrlUpdate}
      defaultOptions={URL_STATE_DEFAULTS}
      processUrlSearchParams={orderSearchParams}
      hasMemory
    >
      {children}
    </NuqsTestingAdapter>
  );
  return { ...renderHook(() => useOrdersListParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useOrdersListParams reading', () => {
  it('reads page 1 and size 20 and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual(DEFAULTS);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads a page and a size of 50', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3&size=50');

    expect(result.current[0]).toEqual({ ...DEFAULTS, page: 3, size: 50 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['10', '20', '50', '100'])('keeps the allowed size %s', (size) => {
    const { result } = renderParams(`?size=${size}`);

    expect(result.current[0].size).toBe(Number(size));
  });

  it('falls back from size=33 to the default and removes it with one replace (T-08-08)', async () => {
    const { result, onUrlUpdate } = renderParams('?size=33');

    expect(result.current[0]).toEqual(DEFAULTS);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('falls back from page=0 and size=9999 and removes both with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=9999&page=0');

    expect(result.current[0]).toEqual(DEFAULTS);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('removes default values that are written out', async () => {
    const { onUrlUpdate } = renderParams('?page=1&size=20');

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('holds only the list keys: never a name, phone or email key (T-08-17)', () => {
    const { result } = renderParams('');

    expect(Object.keys(result.current[0]).sort()).toEqual([
      'dates',
      'from',
      'hasBalance',
      'page',
      'productType',
      'q',
      'size',
      'sort',
      'status',
      'to',
    ]);
  });

  it('reads the search from q and writes nothing to the URL', async () => {
    const { result, onUrlUpdate } = renderParams('?q=0148');

    expect(result.current[0].q).toBe('0148');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads accented text as it is (Pena with a tilde n) and keeps the URL as written', async () => {
    const { result, onUrlUpdate } = renderParams('?q=Pe%C3%B1a%20Dela%20Cruz');

    expect(result.current[0].q).toBe('Peña Dela Cruz');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('cuts a search of 101 characters to 100 and rewrites the URL with one replace (T-08-16)', async () => {
    const { result, onUrlUpdate } = renderParams(`?q=${'a'.repeat(101)}`);

    expect(result.current[0].q).toBe('a'.repeat(100));
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?q=${'a'.repeat(100)}` }]);
  });

  it('treats a blank search as no search and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?q=%20%20');

    expect(result.current[0].q).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});

describe('useOrdersListParams writing', () => {
  it('a page change pushes a history entry', async () => {
    const { result, onUrlUpdate } = renderParams('');

    act(() => {
      result.current[1].setPage(2);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2' }]);
  });

  it('a size change replaces the history entry and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setPageSize(50);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=50' }]);
    expect(result.current[0]).toEqual({ ...DEFAULTS, size: 50 });
  });

  it('a typed search is written after 300 ms with one replace that also resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setSearch('0148');
    });
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=0148' }]);
  });

  it('an empty search sends nothing and leaves no q in the URL', async () => {
    const { result, onUrlUpdate } = renderParams('?q=0148');

    act(() => {
      result.current[1].setSearch('   ', { immediate: true });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current[0].q).toBeNull();
  });

  it('a page past the last becomes the last page with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?page=9');

    act(() => {
      result.current[1].clampPage(3);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=3' }]);
  });
});

describe('useOrdersListParams filters (ORD-02, T-08-16)', () => {
  it('lists the allowed values: nine statuses, four sorts and four date choices', () => {
    expect(ORDER_STATUS_FILTERS).toEqual([
      'active',
      'all',
      'pending',
      'mockup',
      'production',
      'ready',
      'delivered',
      'completed',
      'cancelled',
    ]);
    expect(ORDER_SORTS).toEqual(['due', 'newest', 'balance', 'total']);
    expect(ORDER_DATE_RANGES).toEqual(['30d', '90d', 'month', 'custom']);
  });

  it('starts with Active + recent, due date order and Any date, and writes nothing to the URL', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual(DEFAULTS);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['all', 'pending', 'mockup', 'production', 'ready', 'delivered', 'completed', 'cancelled'])(
    'reads status=%s',
    (status) => {
      const { result } = renderParams(`?status=${status}`);

      expect(result.current[0].status).toBe(status);
    },
  );

  it.each(['newest', 'balance', 'total'])('reads sort=%s', (sort) => {
    const { result } = renderParams(`?sort=${sort}`);

    expect(result.current[0].sort).toBe(sort);
  });

  it('reads dates, hasBalance and a product type id (lower-cased)', () => {
    const { result } = renderParams(`?dates=90d&hasBalance=true&productType=${PRODUCT_ID.toUpperCase()}`);

    expect(result.current[0]).toEqual({ ...DEFAULTS, dates: '90d', hasBalance: 'true', productType: PRODUCT_ID });
  });

  it.each([
    ['?status=archived', { status: 'active' }],
    ['?sort=oldest', { sort: 'due' }],
    ['?dates=7d', { dates: null }],
    ['?hasBalance=false', { hasBalance: null }],
    ['?productType=basketball', { productType: null }],
    ['?productType=00000000-0000-0000-0000-000000000000', { productType: null }],
  ])('falls back from %s and removes it with one replace', async (search, expected) => {
    const { result, onUrlUpdate } = renderParams(search);

    expect(result.current[0]).toEqual({ ...DEFAULTS, ...expected });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('removes status=active and sort=due, which are the defaults', async () => {
    const { onUrlUpdate } = renderParams('?status=active&sort=due');

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('reads a custom pair and keeps the URL as written, including one day (From equal to To)', async () => {
    const { result, onUrlUpdate } = renderParams('?dates=custom&from=2026-10-05&to=2026-10-05');

    expect(result.current[0]).toMatchObject({ dates: 'custom', from: '2026-10-05', to: '2026-10-05' });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing To', '?dates=custom&from=2026-10-05'],
    ['a missing From', '?dates=custom&to=2026-10-05'],
    ['no dates at all', '?dates=custom'],
    ['From after To', '?dates=custom&from=2026-10-31&to=2026-10-01'],
    ['an invalid From', '?dates=custom&from=2026-02-30&to=2026-03-01'],
  ])('drops dates, from and to with one replace for a custom range with %s', async (_name, search) => {
    const { result, onUrlUpdate } = renderParams(search);

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current[0]).toMatchObject({ dates: null, from: null, to: null });
  });

  it('shows a broken custom pair as Any date at once, before the replace lands', () => {
    const { result } = renderParams('?dates=custom&from=2026-10-31&to=2026-10-01');

    expect(result.current[0]).toMatchObject({ dates: null, from: null, to: null });
  });

  it('drops a stray from and to that no custom range owns, keeping a preset', async () => {
    const { result, onUrlUpdate } = renderParams('?dates=30d&from=2026-10-01&to=2026-10-31');

    expect(result.current[0]).toMatchObject({ dates: '30d', from: null, to: null });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?dates=30d' }]);
  });

  it('holds no key that could carry a customer name, phone, email or address (T-08-17)', () => {
    const { result } = renderParams('');

    expect(Object.keys(result.current[0]).filter((key) => /name|phone|email|address|mobile/i.test(key))).toEqual([]);
  });
});

describe('useOrdersListParams filter writes (ORD-02)', () => {
  it('a filter change replaces the entry and resets the page in one update', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setFilter('status', 'delivered');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?status=delivered' }]);
  });

  it('choosing the default status removes it from the URL', async () => {
    const { result, onUrlUpdate } = renderParams('?status=delivered');

    act(() => {
      result.current[1].setFilter('status', 'active');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it.each(['newest', 'balance', 'total'] as const)('sort %s is written as that key', async (sort) => {
    const { result, onUrlUpdate } = renderParams('?page=2');

    act(() => {
      result.current[1].setFilter('sort', sort);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?sort=${sort}` }]);
  });

  it('a custom range is written as dates, from and to in one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setFilters({ dates: 'custom', from: '2026-10-01', to: '2026-10-31' });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([
      { history: 'replace', query: '?dates=custom&from=2026-10-01&to=2026-10-31' },
    ]);
  });

  it('a page change pushes and keeps the filters', async () => {
    const { result, onUrlUpdate } = renderParams('?status=delivered');

    act(() => {
      result.current[1].setPage(2);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2&status=delivered' }]);
  });
});

describe('resolveOrderDateRange (D-59, ORD-02)', () => {
  const TODAY = '2026-10-29';

  it('is no range for Any date', () => {
    expect(resolveOrderDateRange(null, null, null, TODAY)).toBeNull();
  });

  it('works Last 30 days out with the Phase 6 last-30-days rule from the server today', () => {
    expect(resolveOrderDateRange('30d', null, null, TODAY)).toEqual({ from: '2026-09-30', to: TODAY });
    expect(resolveOrderDateRange('30d', null, null, TODAY)).toEqual(resolveRangePreset('last-30-days', TODAY));
  });

  it('works Last 90 days out the same way: 89 days back to today', () => {
    expect(resolveOrderDateRange('90d', null, null, TODAY)).toEqual({ from: '2026-08-01', to: TODAY });
    expect(resolveOrderDateRange('90d', null, null, '2026-01-15')).toEqual({ from: '2025-10-18', to: '2026-01-15' });
  });

  it('works This month out from the first of the month to today', () => {
    expect(resolveOrderDateRange('month', null, null, TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(resolveOrderDateRange('month', null, null, '2026-03-01')).toEqual({ from: '2026-03-01', to: '2026-03-01' });
  });

  it('crosses a year start for Last 30 days', () => {
    expect(resolveOrderDateRange('30d', null, null, '2026-01-15')).toEqual({ from: '2025-12-17', to: '2026-01-15' });
  });

  it('ignores stray from and to for a preset', () => {
    expect(resolveOrderDateRange('month', '2020-01-01', '2020-01-02', TODAY)).toEqual({
      from: '2026-10-01',
      to: TODAY,
    });
  });

  it('gives a custom range as it is, and none while a date is missing', () => {
    expect(resolveOrderDateRange('custom', '2026-10-01', '2026-10-31', TODAY)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(resolveOrderDateRange('custom', '2026-10-01', null, TODAY)).toBeNull();
    expect(resolveOrderDateRange('custom', null, '2026-10-31', TODAY)).toBeNull();
  });

  it('needs no today for a custom range, and gives none for a preset while today is unknown', () => {
    expect(resolveOrderDateRange('custom', '2026-10-01', '2026-10-31', null)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(resolveOrderDateRange('30d', null, null, null)).toBeNull();
  });
});
