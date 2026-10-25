import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useExpensesListParams } from './useExpensesListParams';

// The Company Expenses list keeps its page and page size in the URL (CEXP-01, WEB-10, T-06-17).

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

    expect(result.current[0]).toEqual({ page: 1, size: 20 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads a page and a size', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3&size=50');

    expect(result.current[0]).toEqual({ page: 3, size: 50 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('falls back from size=9999 and page=0 and removes both with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=9999&page=0');

    expect(result.current[0]).toEqual({ page: 1, size: 20 });
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
    expect(result.current[0]).toEqual({ page: 1, size: 50 });
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

  it('holds only page and size: never a name or an email key', () => {
    const { result } = renderParams('');

    expect(Object.keys(result.current[0]).sort()).toEqual(['page', 'size']);
  });
});
