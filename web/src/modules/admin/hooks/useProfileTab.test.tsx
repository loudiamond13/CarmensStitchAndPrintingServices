import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useProfileTab } from './useProfileTab';

// The My Profile tab lives in the URL `tab` parameter (D-23, WEB-10, T-05-33).

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
  return { ...renderHook(() => useProfileTab(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useProfileTab', () => {
  it('reads details and writes nothing to the URL when there is no tab parameter', async () => {
    const { result, onUrlUpdate } = renderTab('');

    expect(result.current.tab).toBe('details');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['details', 'security', 'appearance'] as const)('reads ?tab=%s', async (tab) => {
    const { result } = renderTab(`?tab=${tab}`);

    expect(result.current.tab).toBe(tab);
    await settle();
  });

  it('writes tab=security with a replace, not a push', async () => {
    const { result, onUrlUpdate } = renderTab('');

    act(() => {
      result.current.setTab('security');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?tab=security' }]);
    expect(result.current.tab).toBe('security');
  });

  it('keeps the default tab out of the URL: choosing details removes the parameter', async () => {
    const { result, onUrlUpdate } = renderTab('?tab=appearance');

    act(() => {
      result.current.setTab('details');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(result.current.tab).toBe('details');
  });

  it('falls back to details for ?tab=bogus and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderTab('?tab=bogus');

    expect(result.current.tab).toBe('details');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it.each(['?tab=Security', '?tab=', '?tab=security%20', '?tab=details'])(
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
