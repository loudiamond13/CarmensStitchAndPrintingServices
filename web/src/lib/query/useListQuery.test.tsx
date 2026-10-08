import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
});
