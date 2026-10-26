import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useDeletedExpensesListParams } from './useDeletedExpensesListParams';

// The Deleted Expenses list keeps its view in the URL (D-03, D-07, WEB-10): page, size, the search and one category. No dates.

const NO_FILTERS = { q: null, category: null } as const;
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
  return { ...renderHook(() => useDeletedExpensesListParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useDeletedExpensesListParams reading', () => {
  it('reads page 1 and size 20 and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ ...NO_FILTERS, page: 1, size: 20 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('holds only page, size, q and category: no dates, never a name or an email key', () => {
    const { result } = renderParams('?from=2026-10-01&to=2026-10-31');

    expect(Object.keys(result.current[0]).sort()).toEqual(['category', 'page', 'q', 'size']);
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

  it('reads q trimmed and capped at 100 characters', () => {
    expect(renderParams('?q=%20%20Meralco%20bill%20%20').result.current[0].q).toBe('Meralco bill');
    expect(renderParams(`?q=${'a'.repeat(150)}`).result.current[0].q).toBe('a'.repeat(100));
  });

  it('reads a dashed category id and lower-cases it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams(`?category=${RENT_ID.toUpperCase()}`);

    expect(result.current[0].category).toBe(RENT_ID);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?category=${RENT_ID}` }]);
  });

  it.each(['bogus', 'person%40example.com'])('falls back from category=%s with one replace', async (value) => {
    const { result, onUrlUpdate } = renderParams(`?category=${value}`);

    expect(result.current[0].category).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});

describe('useDeletedExpensesListParams writing', () => {
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
});
