import { hashKey, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { listKey } from './keys';
import { createQueryClient } from './queryClient';
import { useListQuery } from './useListQuery';

// Parsed, defaulted list params, as a list's URL-state hook hands them over (WEB-08, WEB-10).
interface OrderListParams {
  page: number;
  pageSize: number;
  status: 'all' | 'active' | 'done';
}

interface Rows {
  rows: string[];
}

type Fetcher = (params: OrderListParams, signal: AbortSignal) => Promise<Rows>;

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function cachedKeys(client: QueryClient): unknown[] {
  return client
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
}

describe('listKey', () => {
  it('builds [resource, "list", params] from the parsed values', () => {
    expect(listKey('orders', { page: 2, pageSize: 20, status: 'done' })).toEqual([
      'orders',
      'list',
      { page: 2, pageSize: 20, status: 'done' },
    ]);
  });

  it('gives equal params the same cache entry whatever their property order', () => {
    expect(hashKey(listKey('orders', { page: 2, status: 'done', q: 'jersey' }))).toBe(
      hashKey(listKey('orders', { q: 'jersey', status: 'done', page: 2 })),
    );
  });
});

describe('useListQuery', () => {
  it('keys the query with listKey on the parsed params and hands the fetcher the params and an AbortSignal', async () => {
    const client = createQueryClient();
    const params: OrderListParams = { page: 1, pageSize: 20, status: 'all' };
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve({ rows: ['CSPS-0001'] }));

    const { result } = renderHook(() => useListQuery({ key: 'orders', params, fetcher }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ rows: ['CSPS-0001'] });
    });
    expect(cachedKeys(client)).toEqual([listKey('orders', params)]);
    expect(cachedKeys(client)).toEqual([['orders', 'list', { page: 1, pageSize: 20, status: 'all' }]]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toEqual(params);
    expect(fetcher.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it('keeps the previous page visible as placeholder data until the next page arrives', async () => {
    const client = createQueryClient();
    let resolvePage2: (rows: Rows) => void = () => undefined;
    const fetcher = vi.fn<Fetcher>((params) =>
      params.page === 1
        ? Promise.resolve({ rows: ['page 1'] })
        : new Promise<Rows>((resolve) => {
            resolvePage2 = resolve;
          }),
    );
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useListQuery({ key: 'orders', params: { page, pageSize: 20, status: 'all' } satisfies OrderListParams, fetcher }),
      { wrapper: wrapperFor(client), initialProps: { page: 1 } },
    );
    await waitFor(() => {
      expect(result.current.data).toEqual({ rows: ['page 1'] });
    });
    expect(result.current.isPlaceholderData).toBe(false);

    rerender({ page: 2 });
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
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

  it('aborts the in-flight request when the screen unmounts', async () => {
    const client = createQueryClient();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn<Fetcher>((_params, signal) => {
      signals.push(signal);
      return new Promise<Rows>(() => undefined);
    });
    const { unmount } = renderHook(
      () => useListQuery({ key: 'orders', params: { page: 1, pageSize: 20, status: 'all' }, fetcher }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => {
      expect(signals).toHaveLength(1);
    });
    expect(signals[0]?.aborted).toBe(false);

    unmount();

    expect(signals[0]?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
