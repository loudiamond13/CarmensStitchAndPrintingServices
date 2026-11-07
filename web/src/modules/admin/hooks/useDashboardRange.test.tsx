import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { DASHBOARD_RANGES, RANGE_MONTHS, useDashboardRange } from './useDashboardRange';

// The chart range lives in the URL `range` parameter (DASH-03, WEB-10): 6m is the default and stays out of the URL.

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function renderRange(searchParams = '') {
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
  return { ...renderHook(() => useDashboardRange(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useDashboardRange reading', () => {
  it('offers 6m and 12m and maps them to 6 and 12 months', () => {
    expect(DASHBOARD_RANGES).toEqual(['6m', '12m']);
    expect(RANGE_MONTHS).toEqual({ '6m': 6, '12m': 12 });
  });

  it('reads 6m and writes nothing to the URL when there is no range parameter', async () => {
    const { result, onUrlUpdate } = renderRange('');

    expect(result.current.range).toBe('6m');
    expect(result.current.months).toBe(6);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads ?range=12m as 12 months', async () => {
    const { result, onUrlUpdate } = renderRange('?range=12m');

    expect(result.current.range).toBe('12m');
    expect(result.current.months).toBe(12);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['7m', '12M', '12', '', 'all', '6m%20'])('falls back from range=%s and removes it with one replace', async (value) => {
    const { result, onUrlUpdate } = renderRange(`?range=${value}`);

    expect(result.current.range).toBe('6m');
    expect(result.current.months).toBe(6);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('removes a range=6m that only repeats the default with one replace', async () => {
    const { result, onUrlUpdate } = renderRange('?range=6m');

    expect(result.current.range).toBe('6m');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});

describe('useDashboardRange writing', () => {
  it('writes range=12m with a replace, not a push', async () => {
    const { result, onUrlUpdate } = renderRange('');

    act(() => {
      result.current.setRange('12m');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?range=12m' }]);
    expect(result.current.range).toBe('12m');
    expect(result.current.months).toBe(12);
  });

  it('removes the parameter when 6m is chosen again', async () => {
    const { result, onUrlUpdate } = renderRange('?range=12m');

    act(() => {
      result.current.setRange('6m');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current.range).toBe('6m');
  });

  it('keeps the other parameters of the URL', async () => {
    const { result, onUrlUpdate } = renderRange('?tab=money');

    act(() => {
      result.current.setRange('12m');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?tab=money&range=12m' }]);
  });
});
