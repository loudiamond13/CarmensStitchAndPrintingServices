import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useGalleryTabParams } from '@/modules/admin/hooks/useGalleryTabParams';
import { LINE_IDS } from '@/test/siteContentFixtures';

// The Gallery tab keeps its view in the URL (WEB-10, GAL-03, T-11-81; plan 11-32): the line, the page and the rows per page. Defaults stay
// out of the URL; an invalid value falls back and is removed with one replace; a line or size change replaces the entry and resets the page;
// a page change pushes.

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

const LINES = Object.values(LINE_IDS);

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function renderParams(searchParams = '', lineIds: readonly string[] | 'loading' = LINES) {
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
  const view = renderHook(({ ids }) => useGalleryTabParams(ids), { wrapper, initialProps: { ids: lineIds === 'loading' ? undefined : lineIds } });
  return { ...view, onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('reading', () => {
  it('reads every line, page 1 and 20 rows, and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ line: null, page: 1, size: 20 });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads a line, a page and a size', () => {
    const { result } = renderParams(`?line=${LINE_IDS.moto}&page=3&size=50`);

    expect(result.current[0]).toEqual({ line: LINE_IDS.moto, page: 3, size: 50 });
  });

  it('holds only line, page and size: never a name or an email key', () => {
    const { result } = renderParams('?q=Liza&tab=gallery');

    expect(Object.keys(result.current[0]).sort()).toEqual(['line', 'page', 'size']);
  });

  it('falls back from size=9999 and page=0 to 20 and 1 and removes both with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=9999&page=0');

    expect(result.current[0]).toMatchObject({ page: 1, size: 20 });
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
  });

  it('drops a line that is not a GUID with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?line=basketball');

    expect(result.current[0].line).toBeNull();
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
  });
});

describe('the line is checked against the lines that loaded', () => {
  it('keeps the line while the lines are still loading', async () => {
    const { result, onUrlUpdate } = renderParams(`?line=${LINE_IDS.moto}`, 'loading');

    expect(result.current[0].line).toBe(LINE_IDS.moto);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('drops a line that is not among the loaded lines with one replace, and reads it as every line at once', async () => {
    const stranger = '8c1f4a20-0000-4000-8000-0000000000ff';
    const { result, onUrlUpdate } = renderParams(`?line=${stranger}&page=2`);

    expect(result.current[0].line).toBeNull();
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
  });

  it('drops it once the lines arrive, and keeps a line that is among them', async () => {
    const stranger = '8c1f4a20-0000-4000-8000-0000000000ff';
    const { result, rerender, onUrlUpdate } = renderParams(`?line=${stranger}`, 'loading');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();

    rerender({ ids: LINES });

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    expect(result.current[0].line).toBeNull();
  });

  it('keeps a known line and writes nothing', async () => {
    const { result, onUrlUpdate } = renderParams(`?line=${LINE_IDS.polo}`);

    expect(result.current[0].line).toBe(LINE_IDS.polo);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe('writing', () => {
  it('a line change replaces the entry and resets the page to 1', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setFilter('line', LINE_IDS.moto);
    });

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?line=${LINE_IDS.moto}` }]);
    });
  });

  it('a size change replaces the entry and resets the page to 1', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setPageSize(50);
    });

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=50' }]);
    });
  });

  it('a page change pushes a history entry', async () => {
    const { result, onUrlUpdate } = renderParams('');

    act(() => {
      result.current[1].setPage(2);
    });

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2' }]);
    });
  });

  it('a page past the last page becomes the last page with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?page=9');

    act(() => {
      result.current[1].clampPage(3);
    });

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=3' }]);
    });
  });
});
