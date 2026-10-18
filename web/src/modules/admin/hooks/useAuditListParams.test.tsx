import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useAuditListParams } from './useAuditListParams';

// The Audit Log keeps its range, filters and page in the URL (AUDIT-02, D-26, WEB-10, T-05-91, T-05-92).

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

const ID = '00000000-0000-4000-8000-000000000002';

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
  return { ...renderHook(() => useAuditListParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useAuditListParams reading', () => {
  it('reads the last 7 days with no filter and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({
      page: 1,
      size: 20,
      range: 'last-7-days',
      from: null,
      to: null,
      actor: null,
      action: null,
      target: null,
    });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['last-30-days', 'this-month', 'last-month', 'all'] as const)('reads range=%s', async (range) => {
    const { result, onUrlUpdate } = renderParams(`?range=${range}`);

    expect(result.current[0].range).toBe(range);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads range=custom with its two business dates', () => {
    const { result } = renderParams('?range=custom&from=2026-09-01&to=2026-09-15');

    expect(result.current[0]).toMatchObject({ range: 'custom', from: '2026-09-01', to: '2026-09-15' });
  });

  it('falls back from range=forever and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?range=forever');

    expect(result.current[0].range).toBe('last-7-days');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('falls back from from=2026-02-30 and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?range=custom&from=2026-02-30&to=2026-09-15');

    expect(result.current[0]).toMatchObject({ range: 'custom', from: null, to: '2026-09-15' });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?range=custom&to=2026-09-15' }]);
  });

  it('reads actor as a user id and as system, and lower-cases the id', () => {
    expect(renderParams(`?actor=${ID}`).result.current[0].actor).toBe(ID);
    expect(renderParams('?actor=system').result.current[0].actor).toBe('system');
    expect(renderParams(`?actor=${ID.toUpperCase()}`).result.current[0].actor).toBe(ID);
  });

  it.each([
    'carmen@example.ph',
    'carmen%40example.ph',
    'SYSTEM',
    'Carmen Reyes',
    '123',
    `${ID}x`,
    `${ID.replaceAll('-', '')}`,
  ])('refuses actor=%s and removes it with one replace', async (value) => {
    const { result, onUrlUpdate } = renderParams(`?actor=${value}`);

    expect(result.current[0].actor).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('reads action only when it is a known code', async () => {
    expect(renderParams('?action=user.deactivated').result.current[0].action).toBe('user.deactivated');

    const { result, onUrlUpdate } = renderParams('?action=orders.archived');
    expect(result.current[0].action).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('reads target only when it is a user id: not system, not an email', async () => {
    expect(renderParams(`?target=${ID}`).result.current[0].target).toBe(ID);
    expect(renderParams('?target=system').result.current[0].target).toBeNull();
    expect(renderParams('?target=carmen%40example.ph').result.current[0].target).toBeNull();
    await settle();
  });
});

describe('useAuditListParams writing', () => {
  it('a filter change replaces the history entry and resets the page in the same update', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3');

    act(() => {
      result.current[1].setFilter('actor', ID);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?actor=${ID}` }]);
  });

  it('setFilters writes a custom range with its dates in one replace', async () => {
    const { result, onUrlUpdate } = renderParams('');

    act(() => {
      result.current[1].setFilters({ range: 'custom', from: '2026-10-01', to: '2026-10-12' });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([
      { history: 'replace', query: '?from=2026-10-01&range=custom&to=2026-10-12' },
    ]);
  });

  it('choosing a preset removes from and to, and the default range leaves the URL', async () => {
    const { result, onUrlUpdate } = renderParams('?range=custom&from=2026-10-01&to=2026-10-12');

    act(() => {
      result.current[1].setFilters({ range: 'last-7-days', from: null, to: null });
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('a page change pushes a history entry', async () => {
    const { result, onUrlUpdate } = renderParams('');

    act(() => {
      result.current[1].setPage(2);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2' }]);
  });
});
