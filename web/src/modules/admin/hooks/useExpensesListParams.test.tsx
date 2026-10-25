import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useExpensesListParams } from './useExpensesListParams';

// The Company Expenses list keeps its view in the URL (CEXP-01, WEB-10, D-23, T-06-17, T-06-23). The dates are read only as a pair.

const NO_FILTERS = { q: null, category: null, from: null, to: null } as const;
const RENT_ID = '6869715c-a01f-4053-87d8-8fd39feebebc';

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
  return { ...renderHook(() => useExpensesListParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useExpensesListParams reading', () => {
  it('reads page 1 and size 20 and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 1, size: 20 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads a page and a size', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3&size=50');

    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 3, size: 50 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('falls back from size=9999 and page=0 and removes both with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=9999&page=0');

    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 1, size: 20 });
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
});

describe('useExpensesListParams writing', () => {
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
    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 1, size: 50 });
  });

  it('keeps the defaults out of the URL when they are chosen again', async () => {
    const { result, onUrlUpdate } = renderParams('?page=2&size=50');

    act(() => {
      result.current[1].setPageSize(20);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('a page past the last becomes the last page with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?page=9');

    act(() => {
      result.current[1].clampPage(4);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=4' }]);
  });

  it('holds only page, size, q, category, from and to: never a name or an email key', () => {
    const { result } = renderParams('');

    expect(Object.keys(result.current[0]).sort()).toEqual(['category', 'from', 'page', 'q', 'size', 'to']);
  });
});

describe('useExpensesListParams search', () => {
  it('reads q trimmed and rewrites the untrimmed URL with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?q=%20%20Meralco%20bill%20%20');

    expect(result.current[0].q).toBe('Meralco bill');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=Meralco+bill' }]);
  });

  it('caps q at 100 characters', () => {
    const { result } = renderParams(`?q=${'a'.repeat(150)}`);

    expect(result.current[0].q).toBe('a'.repeat(100));
  });

  it('a search change replaces the history entry and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setSearch('Meralco', { immediate: true });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=Meralco' }]);
    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 1, size: 20, q: 'Meralco' });
  });

  it('never writes an empty q: blank text removes the key', async () => {
    const { result, onUrlUpdate } = renderParams('?q=rent');

    act(() => {
      result.current[1].setSearch('   ', { immediate: true });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current[0].q).toBeNull();
  });
});

describe('useExpensesListParams category', () => {
  it('reads a dashed category id and lower-cases it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams(`?category=${RENT_ID.toUpperCase()}`);

    expect(result.current[0].category).toBe(RENT_ID);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?category=${RENT_ID}` }]);
  });

  it.each(['bogus', 'person%40example.com', '6869715ca01f405387d88fd39feebebc'])(
    'falls back from category=%s and removes it with one replace',
    async (value) => {
      const { result, onUrlUpdate } = renderParams(`?category=${value}`);

      expect(result.current[0].category).toBeNull();
      await waitFor(() => {
        expect(onUrlUpdate).toHaveBeenCalled();
      });
      await settle();
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    },
  );

  it('a category change replaces the history entry and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setFilter('category', RENT_ID);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?category=${RENT_ID}` }]);
  });
});

describe('useExpensesListParams dates (D-23: read only as a pair)', () => {
  it('keeps a valid pair and writes nothing', async () => {
    const { result, onUrlUpdate } = renderParams('?from=2026-10-01&to=2026-10-31');

    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 1, size: 20, from: '2026-10-01', to: '2026-10-31' });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('keeps a one-day pair', async () => {
    const { result, onUrlUpdate } = renderParams('?from=2026-10-05&to=2026-10-05');

    expect(result.current[0].from).toBe('2026-10-05');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['from without to', '?from=2026-10-01'],
    ['to without from', '?to=2026-10-31'],
    ['an invalid from', '?from=2026-02-30&to=2026-03-01'],
    ['an invalid to', '?from=2026-03-01&to=2026-02-30'],
    ['from after to', '?from=2026-10-31&to=2026-10-01'],
    ['two invalid dates', '?from=nope&to=2026-13-01'],
  ])('drops both dates for %s with one replace', async (_name, search) => {
    const { result, onUrlUpdate } = renderParams(search);

    expect(result.current[0].from).toBeNull();
    expect(result.current[0].to).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('keeps the other filters when it drops a broken pair', async () => {
    const { result, onUrlUpdate } = renderParams(`?q=rent&category=${RENT_ID}&from=2026-10-31&to=2026-10-01`);

    expect(result.current[0]).toMatchObject({ q: 'rent', category: RENT_ID, from: null, to: null });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?category=${RENT_ID}&q=rent` }]);
  });

  it('writes a pair with one replace and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=2');

    act(() => {
      result.current[1].setFilters({ from: '2026-10-01', to: '2026-10-31' });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?from=2026-10-01&to=2026-10-31' }]);
  });

  it('clears the pair with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?from=2026-10-01&to=2026-10-31');

    act(() => {
      result.current[1].setFilters({ from: null, to: null });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});
