import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useVisitorStatsParams } from './useVisitorStatsParams';

// Visitor Stats keeps its date range in the URL (D-24, WEB-10, T-12-61): allow-listed range names, calendar dates for custom.

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
  return { ...renderHook(() => useVisitorStatsParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useVisitorStatsParams reading', () => {
  it('reads the last 30 days and writes nothing when the URL has no range', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ range: 'last-30-days', from: null, to: null });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['last-7-days', 'this-month', 'last-month', 'this-year'] as const)('reads range=%s', async (range) => {
    const { result, onUrlUpdate } = renderParams(`?range=${range}`);

    expect(result.current[0].range).toBe(range);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads range=custom with its two business dates', () => {
    const { result } = renderParams('?range=custom&from=2026-01-05&to=2026-02-04');

    expect(result.current[0]).toEqual({ range: 'custom', from: '2026-01-05', to: '2026-02-04' });
  });

  it.each(['today', 'forever'])(
    'falls back from range=%s to the last 30 days and removes it with one replace',
    async (range) => {
      const { result, onUrlUpdate } = renderParams(`?range=${range}`);

      expect(result.current[0].range).toBe('last-30-days');
      await waitFor(() => {
        expect(onUrlUpdate).toHaveBeenCalled();
      });
      await settle();
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    },
  );

  it('drops a from or to that is not a calendar date', () => {
    const { result } = renderParams('?range=custom&from=2026-02-30&to=soon');

    expect(result.current[0]).toEqual({ range: 'custom', from: null, to: null });
  });
});

describe('useVisitorStatsParams writing', () => {
  it('writes a preset by name with replace, and the default removes it', async () => {
    const { result, onUrlUpdate } = renderParams('');

    act(() => {
      result.current[1].setFilters({ range: 'this-year', from: null, to: null });
    });
    await waitFor(() => {
      expect(result.current[0].range).toBe('this-year');
    });
    act(() => {
      result.current[1].setFilters({ range: 'last-30-days', from: null, to: null });
    });
    await waitFor(() => {
      expect(result.current[0].range).toBe('last-30-days');
    });
    await settle();

    expect(updates(onUrlUpdate)).toEqual([
      { history: 'replace', query: '?range=this-year' },
      { history: 'replace', query: '' },
    ]);
  });

  it('writes a custom range with its two dates in one replace', async () => {
    const { result, onUrlUpdate } = renderParams('');

    act(() => {
      result.current[1].setFilters({ range: 'custom', from: '2026-01-05', to: '2026-02-04' });
    });
    await settle();

    expect(updates(onUrlUpdate)).toEqual([
      { history: 'replace', query: '?from=2026-01-05&range=custom&to=2026-02-04' },
    ]);
  });
});
