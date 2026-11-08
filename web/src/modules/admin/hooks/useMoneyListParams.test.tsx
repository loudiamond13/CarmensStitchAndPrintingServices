import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';

// The money screens keep their view in the URL (WEB-10, D-31, D-42; plan 10-17): the tab, the page, the rows per page and, for a Manager
// only, Show deleted. Defaults stay out of the URL; an invalid value falls back and is removed with one replace; a Manager-only value in an
// Admin's URL is dropped with one replace and never read.

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

const ADMIN_USER = {
  id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  email: 'lito@example.ph',
  firstName: 'Lito',
  lastName: 'Santos',
  role: 'Admin',
};

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
});

afterEach(() => {
  clearSession();
});

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
  return { ...renderHook(() => useMoneyListParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('reading', () => {
  it('reads the Mine tab, page 1, 20 rows and no Show deleted, and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ tab: 'mine', page: 1, size: 20, deleted: null });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('holds only tab, page, size and deleted: never a name or an email key', () => {
    const { result } = renderParams('?q=Liza&from=2026-10-01');

    expect(Object.keys(result.current[0]).sort()).toEqual(['deleted', 'page', 'size', 'tab']);
  });

  it('reads size=50 as 50', () => {
    expect(renderParams('?size=50').result.current[0].size).toBe(50);
  });

  it('falls back from size=7 to 20 and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=7');

    expect(result.current[0].size).toBe(20);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it.each([
    ['?tab=bogus', 'tab'],
    ['?deleted=false', 'deleted'],
    ['?deleted=1', 'deleted'],
  ])('falls back from %s and removes it with one replace', async (search) => {
    const { result, onUrlUpdate } = renderParams(search);

    expect(result.current[0]).toEqual({ tab: 'mine', page: 1, size: 20, deleted: null });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });
});

describe('the Manager-only values (D-31, D-42)', () => {
  it('keeps tab=staff and deleted=true for a Manager and writes nothing', async () => {
    const { result, onUrlUpdate } = renderParams('?tab=staff&deleted=true');

    expect(result.current[0]).toEqual({ tab: 'staff', page: 1, size: 20, deleted: 'true' });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('drops tab=staff and deleted=true for an Admin with one replace, and reads Mine with no Show deleted at once', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    const { result, onUrlUpdate } = renderParams('?tab=staff&deleted=true');

    expect(result.current[0]).toEqual({ tab: 'mine', page: 1, size: 20, deleted: null });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('drops tab=transfers for an Admin and keeps the rows per page', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    const { result, onUrlUpdate } = renderParams('?tab=transfers&size=50');

    expect(result.current[0]).toMatchObject({ tab: 'mine', size: 50 });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=50' }]);
  });

  it('leaves an Admin URL with only allowed values alone', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    const { onUrlUpdate } = renderParams('?page=2&size=50');

    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe('writing', () => {
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
  });

  it('a Show deleted change replaces the history entry and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3&size=10');

    act(() => {
      result.current[1].setFilter('deleted', 'true');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=10&deleted=true' }]);
  });

  it('turning Show deleted off removes it from the URL with a replace', async () => {
    const { result, onUrlUpdate } = renderParams('?deleted=true');

    act(() => {
      result.current[1].setFilter('deleted', null);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('a page past the last becomes the last page with a replace', async () => {
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
