import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useOrdersListParams } from './useOrdersListParams';

// The Orders list keeps its view in the URL (ORD-01, ORD-02, WEB-10, T-08-08, T-08-16). Page, size and the search; the other filters
// join in the next task of plan 08-09.

const DEFAULTS = { page: 1, size: 20, q: null };

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

    expect(Object.keys(result.current[0]).sort()).toEqual(['page', 'q', 'size']);
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
