import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useUsersListParams } from './useUsersListParams';

// The Users roster keeps its search, filters and page in the URL (USER-01, WEB-10, T-05-57, T-05-58).

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
  return { ...renderHook(() => useUsersListParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('useUsersListParams reading', () => {
  it('reads the defaults and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ page: 1, size: 20, q: null, role: null, status: null });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('reads role=manager and status=locked with a search, a page and a size', async () => {
    const { result, onUrlUpdate } = renderParams('?page=2&size=50&q=carmen&role=manager&status=locked');

    expect(result.current[0]).toEqual({ page: 2, size: 50, q: 'carmen', role: 'manager', status: 'locked' });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it.each(['admin', 'manager'] as const)('reads role=%s', (role) => {
    const { result } = renderParams(`?role=${role}`);

    expect(result.current[0].role).toBe(role);
  });

  it.each(['active', 'inactive', 'locked'] as const)('reads status=%s', (status) => {
    const { result } = renderParams(`?status=${status}`);

    expect(result.current[0].status).toBe(status);
  });

  it('falls back from role=owner and status=bogus and removes both with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?role=owner&status=bogus');

    expect(result.current[0].role).toBeNull();
    expect(result.current[0].status).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('falls back from size=9999 and page=0 and removes both with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=9999&page=0&role=admin');

    expect(result.current[0]).toMatchObject({ page: 1, size: 20, role: 'admin' });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?role=admin' }]);
  });

  it('trims the search and writes the trimmed text back with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?q=%20%20red%20jersey%20%20');

    expect(result.current[0].q).toBe('red jersey');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=red+jersey' }]);
  });

  it('caps the search at 100 characters', async () => {
    const { result } = renderParams(`?q=${'a'.repeat(150)}`);

    expect(result.current[0].q).toBe('a'.repeat(100));
    await settle();
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

describe('useUsersListParams writing', () => {
  it('a filter change replaces the history entry and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3&role=admin');

    act(() => {
      result.current[1].setFilter('role', 'manager');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?role=manager' }]);
    expect(result.current[0]).toMatchObject({ page: 1, role: 'manager' });
  });

  it('a status filter change replaces too, and clearing a filter removes it from the URL', async () => {
    const { result, onUrlUpdate } = renderParams('?role=manager');

    act(() => {
      result.current[1].setFilter('status', 'inactive');
    });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    });
    act(() => {
      result.current[1].setFilter('role', null);
    });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledTimes(2);
    });

    expect(updates(onUrlUpdate)).toEqual([
      { history: 'replace', query: '?role=manager&status=inactive' },
      { history: 'replace', query: '?status=inactive' },
    ]);
  });

  it('a page change pushes a history entry', async () => {
    const { result, onUrlUpdate } = renderParams('?role=manager');

    act(() => {
      result.current[1].setPage(2);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2&role=manager' }]);
  });

  it('keeps page 1 out of the URL', async () => {
    const { result, onUrlUpdate } = renderParams('?page=2');

    act(() => {
      result.current[1].setPage(1);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '' }]);
  });

  it('a search writes after 300 ms with a replace, trimmed, and resets the page', async () => {
    const { result, onUrlUpdate } = renderParams('?page=2');

    act(() => {
      result.current[1].setSearch('  carmen  ');
    });
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(onUrlUpdate).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=carmen' }]);
  });

  it('holds only page, size, q, role and status: never an email or a name key', () => {
    const { result } = renderParams('');

    expect(Object.keys(result.current[0]).sort()).toEqual(['page', 'q', 'role', 'size', 'status']);
  });
});
