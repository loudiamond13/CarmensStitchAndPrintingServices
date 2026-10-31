import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { ORDER_TABS, useOrderTab } from './useOrderTab';

// The order page tab lives in the URL `tab` parameter (ORD-07, WEB-10).

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function renderTab(searchParams = '') {
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
  return { ...renderHook(() => useOrderTab(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useOrderTab', () => {
  it('lists the tabs in order', () => {
    expect(ORDER_TABS).toEqual(['items', 'payments', 'discounts', 'expenses', 'refunds']);
  });

  it('reads items and writes nothing to the URL when there is no tab parameter', async () => {
    const { result, onUrlUpdate } = renderTab('');

    expect(result.current.tab).toBe('items');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(ORDER_TABS.slice(1))('reads ?tab=%s', async (tab) => {
    const { result } = renderTab(`?tab=${tab}`);

    expect(result.current.tab).toBe(tab);
    await settle();
  });

  it('writes tab=payments with a replace, not a push', async () => {
    const { result, onUrlUpdate } = renderTab('');

    act(() => {
      result.current.setTab('payments');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?tab=payments' }]);
    expect(result.current.tab).toBe('payments');
  });

  it('keeps the default tab out of the URL: choosing items removes the parameter', async () => {
    const { result, onUrlUpdate } = renderTab('?tab=expenses');

    act(() => {
      result.current.setTab('items');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current.tab).toBe('items');
  });

  it('falls back to items for ?tab=bogus and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderTab('?tab=bogus');

    expect(result.current.tab).toBe('items');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});
