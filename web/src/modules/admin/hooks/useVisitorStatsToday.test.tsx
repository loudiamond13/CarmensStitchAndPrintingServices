import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { useVisitorStatsToday } from '@/modules/admin/hooks/useVisitorStatsToday';
import { server } from '@/test/msw';
import { buildOrderList, useOrderHandlers } from '@/test/orderFixtures';

// The Visitor Stats custom range needs the business today (D-24). It keeps the last date it was given, so a Manager who stays on
// the page past the 5 minutes a held answer is trusted for does not lose the date limits and the typed range.

let client: QueryClient | undefined;

afterEach(() => {
  vi.useRealTimers();
  client?.clear();
  client = undefined;
});

function renderToday(enabled: boolean) {
  client = createQueryClient();
  const held = client;
  return renderHook(() => useVisitorStatsToday(enabled), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={held}>{children}</QueryClientProvider>
    ),
  });
}

describe('useVisitorStatsToday', () => {
  it('gives the server date once it answers', async () => {
    useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));

    const { result } = renderToday(true);

    expect(result.current.today).toBeNull();
    await waitFor(() => {
      expect(result.current.today).toBe('2026-10-30');
    });
  });

  it('keeps the date after the answer goes stale, instead of going back to null', async () => {
    useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    const { result, rerender } = renderToday(true);
    await waitFor(() => {
      expect(result.current.today).toBe('2026-10-30');
    });

    vi.setSystemTime(new Date('2026-10-29T15:06:00Z'));
    rerender();

    expect(result.current.today).toBe('2026-10-30');
    expect(result.current.isError).toBe(false);
  });

  it('keeps the date and reports no error when the refresh of a stale answer fails', async () => {
    useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    const { result } = renderToday(true);
    await waitFor(() => {
      expect(result.current.today).toBe('2026-10-30');
    });
    vi.setSystemTime(new Date('2026-10-29T15:06:00Z'));
    server.use(http.get('*/api/v1/orders', () => HttpResponse.json({ title: 'Not found' }, { status: 404 })));

    await act(async () => {
      await client?.refetchQueries({ queryKey: ['business-today'] });
    });

    expect(result.current.today).toBe('2026-10-30');
    expect(result.current.isError).toBe(false);
  });

  it('asks for nothing while it is not enabled', () => {
    const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });

    const { result } = renderToday(false);

    expect(result.current.today).toBeNull();
    expect(backend.lists).toHaveLength(0);
  });
});
