import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useOrdersListParams } from './useOrdersListParams';
import { ORDERS_VIEW_KEY, resolveView, useOrdersView } from './useOrdersView';

// The Orders view choice (ORD-10, T-08-21; plan 08-11): the URL's view when valid, else the stored choice when valid, else grid.
// Only the toggle writes the URL and the storage.

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function renderView(search = '') {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter
      searchParams={search}
      onUrlUpdate={onUrlUpdate}
      defaultOptions={URL_STATE_DEFAULTS}
      processUrlSearchParams={orderSearchParams}
      hasMemory
    >
      {children}
    </NuqsTestingAdapter>
  );
  const rendered = renderHook(
    () => {
      const [values, set] = useOrdersListParams();
      return { ...useOrdersView(values, set), page: values.page };
    },
    { wrapper },
  );
  return { ...rendered, onUrlUpdate };
}

function updates(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return spy.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('resolveView (ORD-10)', () => {
  it.each([
    ['table', 'grid', 'table'],
    ['grid', 'table', 'grid'],
    ['grid', 'nonsense', 'grid'],
    ['table', null, 'table'],
    [null, 'table', 'table'],
    [null, 'grid', 'grid'],
    [null, 'nonsense', 'grid'],
    [null, '', 'grid'],
    [null, null, 'grid'],
  ] as const)('URL %s with stored %s shows %s', (urlView, stored, expected) => {
    expect(resolveView(urlView, stored)).toBe(expected);
  });
});

describe('useOrdersView reading (ORD-10)', () => {
  it('names the storage key csps-orders-view', () => {
    expect(ORDERS_VIEW_KEY).toBe('csps-orders-view');
  });

  it('shows the grid when nothing is set anywhere, and writes nothing', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result, onUrlUpdate } = renderView('');

    expect(result.current.view).toBe('grid');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('shows the table for ?view=table even when the stored choice is grid, and leaves the storage alone', async () => {
    window.localStorage.setItem(ORDERS_VIEW_KEY, 'grid');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result, onUrlUpdate } = renderView('?view=table');

    expect(result.current.view).toBe('table');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(ORDERS_VIEW_KEY)).toBe('grid');
  });

  it('shows the grid for ?view=grid with a stored table', () => {
    window.localStorage.setItem(ORDERS_VIEW_KEY, 'table');
    const { result } = renderView('?view=grid');

    expect(result.current.view).toBe('grid');
  });

  it('shows the stored table for a bogus URL view and removes the bogus value with one replace', async () => {
    window.localStorage.setItem(ORDERS_VIEW_KEY, 'table');
    const { result, onUrlUpdate } = renderView('?view=bogus');

    expect(result.current.view).toBe('table');
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(window.localStorage.getItem(ORDERS_VIEW_KEY)).toBe('table');
  });

  it('shows the stored table when the URL has no view', () => {
    window.localStorage.setItem(ORDERS_VIEW_KEY, 'table');
    const { result } = renderView('');

    expect(result.current.view).toBe('table');
  });

  it('shows the grid for a stored value that is not a view', () => {
    window.localStorage.setItem(ORDERS_VIEW_KEY, 'cards');
    const { result } = renderView('?view=grid');

    expect(result.current.view).toBe('grid');
    expect(renderView('').result.current.view).toBe('grid');
  });

  it('reads a choice stored by another tab at the next mount only', async () => {
    const { result } = renderView('');
    expect(result.current.view).toBe('grid');

    window.localStorage.setItem(ORDERS_VIEW_KEY, 'table');
    await settle();
    expect(result.current.view).toBe('grid');
    expect(renderView('').result.current.view).toBe('table');
  });
});

describe('useOrdersView writing (ORD-10, EDGE idempotency)', () => {
  it('writes the URL with a replace and the storage, and keeps the page', async () => {
    const { result, onUrlUpdate } = renderView('?page=3');

    act(() => {
      result.current.setView('table');
    });

    await waitFor(() => {
      expect(result.current.view).toBe('table');
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=3&view=table' }]);
    expect(window.localStorage.getItem(ORDERS_VIEW_KEY)).toBe('table');
    expect(result.current.page).toBe(3);
  });

  it('writes nothing when the view already shown is pressed again', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result, onUrlUpdate } = renderView('');

    act(() => {
      result.current.setView('grid');
    });

    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('writes nothing when the URL view already shown is pressed again', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result, onUrlUpdate } = renderView('?view=table');

    act(() => {
      result.current.setView('table');
    });

    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('can go back and forth, writing each real change once', async () => {
    const { result, onUrlUpdate } = renderView('');

    act(() => {
      result.current.setView('table');
    });
    await waitFor(() => {
      expect(result.current.view).toBe('table');
    });
    act(() => {
      result.current.setView('grid');
    });
    await waitFor(() => {
      expect(result.current.view).toBe('grid');
    });
    await settle();

    expect(updates(onUrlUpdate)).toEqual([
      { history: 'replace', query: '?view=table' },
      { history: 'replace', query: '?view=grid' },
    ]);
    expect(window.localStorage.getItem(ORDERS_VIEW_KEY)).toBe('grid');
  });
});

describe('useOrdersView when the storage throws (private mode, EDGE concurrency)', () => {
  it('shows the grid and logs nothing when reading throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { result } = renderView('');

    expect(result.current.view).toBe('grid');
    expect(error).not.toHaveBeenCalled();
  });

  it('still switches the URL and logs nothing when writing throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });
    const { result, onUrlUpdate } = renderView('');

    act(() => {
      result.current.setView('table');
    });

    await waitFor(() => {
      expect(result.current.view).toBe('table');
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?view=table' }]);
    expect(error).not.toHaveBeenCalled();
  });
});
