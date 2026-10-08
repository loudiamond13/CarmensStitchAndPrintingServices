import { hashKey, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { keys } from './keys';
import { createQueryClient } from './queryClient';
import { useListQuery } from './useListQuery';

interface DemoParams {
  page: number;
  pageSize: number;
  status: 'all' | 'active' | 'done';
}

function wrapperFor(client: ReturnType<typeof createQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useListQuery', () => {
  it('keys the query on the parsed values and hands the queryFn an AbortSignal', async () => {
    const client = createQueryClient();
    const params: DemoParams = { page: 1, pageSize: 20, status: 'all' };
    const queryFn = vi.fn<(params: DemoParams, signal: AbortSignal) => Promise<{ rows: string[] }>>(() =>
      Promise.resolve({ rows: ['a'] }),
    );

    const { result } = renderHook(() => useListQuery({ area: 'demo', params, queryFn }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ rows: ['a'] });
    });
    expect(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ).toEqual([['demo', 'list', { page: 1, pageSize: 20, status: 'all' }]]);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0]?.[0]).toEqual(params);
    expect(queryFn.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it('keeps the previous page on screen as placeholder data until the next page resolves', async () => {
    const client = createQueryClient();
    let resolvePage2: (rows: { rows: string[] }) => void = () => undefined;
    const queryFn = vi.fn<(params: DemoParams, signal: AbortSignal) => Promise<{ rows: string[] }>>((params) =>
      params.page === 1
        ? Promise.resolve({ rows: ['page 1'] })
        : new Promise((resolve) => {
            resolvePage2 = resolve;
          }),
    );
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useListQuery({ area: 'demo', params: { page, pageSize: 20, status: 'all' } satisfies DemoParams, queryFn }),
      { wrapper: wrapperFor(client), initialProps: { page: 1 } },
    );
    await waitFor(() => {
      expect(result.current.data).toEqual({ rows: ['page 1'] });
    });

    rerender({ page: 2 });
    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual({ rows: ['page 1'] });

    act(() => {
      resolvePage2({ rows: ['page 2'] });
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({ rows: ['page 2'] });
    });
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('aborts the superseded query when the search key changes while it is in flight', async () => {
    const client = createQueryClient();
    const signals = new Map<string, AbortSignal>();
    const queryFn = vi.fn((params: { q: string }, signal: AbortSignal) => {
      signals.set(params.q, signal);
      return params.q === 'jer' ? new Promise<string[]>(() => undefined) : Promise.resolve(['jersey']);
    });
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useListQuery({ area: 'demo', params: { q }, queryFn }),
      {
        wrapper: wrapperFor(client),
        initialProps: { q: 'jer' },
      },
    );
    await waitFor(() => {
      expect(signals.has('jer')).toBe(true);
    });
    expect(signals.get('jer')?.aborted).toBe(false);

    rerender({ q: 'jersey' });

    await waitFor(() => {
      expect(result.current.data).toEqual(['jersey']);
    });
    expect(signals.get('jer')?.aborted).toBe(true);
    expect(signals.get('jersey')?.aborted).toBe(false);
  });

  it('does not fetch while disabled', async () => {
    const client = createQueryClient();
    const queryFn = vi.fn(() => Promise.resolve([]));
    const { result } = renderHook(() => useListQuery({ area: 'demo', params: { page: 1 }, queryFn, enabled: false }), {
      wrapper: wrapperFor(client),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('gives equal params the same cache entry whatever their key order', () => {
    expect(hashKey(keys.list('orders', { page: 2, status: 'done', q: 'a' }))).toBe(
      hashKey(keys.list('orders', { q: 'a', status: 'done', page: 2 })),
    );
  });
});

describe('keys', () => {
  it('builds list, detail and site-settings keys as tuples', () => {
    expect(keys.list('orders', { page: 1 })).toEqual(['orders', 'list', { page: 1 }]);
    expect(keys.detail('orders', 42)).toEqual(['orders', 'detail', 42]);
    expect(keys.site.settings()).toEqual(['site', 'settings']);
  });
});
