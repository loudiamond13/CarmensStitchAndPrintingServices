import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { SETTINGS_TABS, useSettingsTab } from './useSettingsTab';

// The Settings tab lives in the URL `tab` parameter (D-31, WEB-10).

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
  return { ...renderHook(() => useSettingsTab(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useSettingsTab', () => {
  it('lists the tabs in order, the order lists first', () => {
    expect(SETTINGS_TABS).toEqual(['product-types', 'payment-methods', 'order-expense-categories', 'expense-categories']);
  });

  it('reads product-types and writes nothing to the URL when there is no tab parameter', async () => {
    const { result, onUrlUpdate } = renderTab('');

    expect(result.current.tab).toBe('product-types');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(SETTINGS_TABS.slice(1))('reads ?tab=%s', async (tab) => {
    const { result } = renderTab(`?tab=${tab}`);

    expect(result.current.tab).toBe(tab);
    await settle();
  });

  it('writes tab=payment-methods with a replace, not a push', async () => {
    const { result, onUrlUpdate } = renderTab('');

    act(() => {
      result.current.setTab('payment-methods');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?tab=payment-methods' }]);
    expect(result.current.tab).toBe('payment-methods');
  });

  it('keeps the default tab out of the URL: choosing product-types removes the parameter', async () => {
    const { result, onUrlUpdate } = renderTab('?tab=expense-categories');

    act(() => {
      result.current.setTab('product-types');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current.tab).toBe('product-types');
  });

  it('falls back to product-types for ?tab=bogus and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderTab('?tab=bogus');

    expect(result.current.tab).toBe('product-types');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it.each(['?tab=Payment-Methods', '?tab=', '?tab=payment-methods%20', '?tab=product-types'])(
    'treats %s as non-canonical and rewrites it once',
    async (search) => {
      const { onUrlUpdate } = renderTab(search);

      await waitFor(() => {
        expect(onUrlUpdate).toHaveBeenCalled();
      });
      await settle();
      expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    },
  );
});
