import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { listKey } from '@/lib/query/keys';
import { useBusinessToday, useBusinessTodayState } from '@/modules/admin/hooks/useBusinessToday';
import { dashboardChartKey } from '@/modules/admin/hooks/useDashboardChartQuery';
import { dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { myMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { dashboardNovemberSummary } from '@/test/dashboardFixtures';
import { MY_MONEY_USER_ID } from '@/test/moneyFixtures';
import { buildOrderList, orderProblem, standardOrderList, useOrderHandlers } from '@/test/orderFixtures';

// The server's business today for the order date presets and the form defaults (D-59, ORD-02; plan 08-09): from any order
// answer already held, else one small list call. The device clock is never read.

let client: QueryClient | undefined;

afterEach(() => {
  vi.useRealTimers();
  client?.clear();
  client = undefined;
});

function renderToday<T>(hook: () => T) {
  client = createQueryClient();
  const held = client;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={held}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), client: held };
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe('useBusinessToday', () => {
  it('gives the today of a cached order list without a request', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    client = createQueryClient();
    client.setQueryData(listKey('orders', { page: 1, pageSize: 20 }), buildOrderList([], { today: '2026-10-29' }));
    const held = client;
    const { result } = renderHook(() => useBusinessToday(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={held}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current).toBe('2026-10-29');
    await settle();
    expect(backend.lists).toHaveLength(0);
  });

  it('asks the server once with a page size of 1 when nothing is cached, and gives null until it answers', async () => {
    const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    const { result } = renderToday(() => useBusinessToday());

    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current).toBe('2026-10-30');
    });
    expect(backend.lists).toHaveLength(1);
    expect(backend.lists[0]?.searchParams.get('pageSize')).toBe('1');
  });

  it('takes the newest answer when several are cached', () => {
    useOrderHandlers({ list: standardOrderList() });
    client = createQueryClient();
    const now = Date.now();
    client.setQueryData(listKey('orders', { page: 1, pageSize: 20 }), buildOrderList([], { today: '2026-10-28' }), {
      updatedAt: now - 2_000,
    });
    client.setQueryData(listKey('orders', { page: 2, pageSize: 20 }), buildOrderList([], { today: '2026-10-29' }), {
      updatedAt: now - 1_000,
    });
    const held = client;
    const { result } = renderHook(() => useBusinessToday(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={held}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current).toBe('2026-10-29');
  });

  it('sends no request while it is not needed, and picks up an order answer that arrives later', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    const { result, client: held } = renderToday(() => useBusinessToday(false));

    await settle();
    expect(result.current).toBeNull();
    expect(backend.lists).toHaveLength(0);

    act(() => {
      held.setQueryData(listKey('orders', { page: 1, pageSize: 20 }), buildOrderList([], { today: '2026-11-02' }));
    });

    await waitFor(() => {
      expect(result.current).toBe('2026-11-02');
    });
    expect(backend.lists).toHaveLength(0);
  });
});

describe('a held day that has gone stale (WR-03)', () => {
  const wrap = (held: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={held}>{children}</QueryClientProvider>;
    };

  it('does not hand out yesterday after midnight in Manila: an old held list makes the hook ask the server', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    client = createQueryClient();
    client.setQueryData(listKey('orders', { page: 1, pageSize: 20 }), buildOrderList([], { today: '2026-10-29' }));
    vi.setSystemTime(new Date('2026-10-29T16:10:00Z'));
    const { result } = renderHook(() => useBusinessToday(), { wrapper: wrap(client) });

    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current).toBe('2026-10-30');
    });
    expect(backend.lists).toHaveLength(1);
  });

  it('still uses a held list that was read a few minutes ago, without a request', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    client = createQueryClient();
    client.setQueryData(listKey('orders', { page: 1, pageSize: 20 }), buildOrderList([], { today: '2026-10-29' }));
    vi.setSystemTime(new Date('2026-10-29T15:03:00Z'));
    const { result } = renderHook(() => useBusinessToday(), { wrapper: wrap(client) });

    expect(result.current).toBe('2026-10-29');
    await settle();
    expect(backend.lists).toHaveLength(0);
  });

  it('asks again instead of reusing the answer to its own earlier question', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    const days = ['2026-10-29', '2026-10-30'];
    const backend = useOrderHandlers({ list: () => buildOrderList([], { today: days.shift() ?? '2026-10-30' }) });
    client = createQueryClient();
    const first = renderHook(() => useBusinessToday(), { wrapper: wrap(client) });
    await waitFor(() => {
      expect(first.result.current).toBe('2026-10-29');
    });
    first.unmount();

    vi.setSystemTime(new Date('2026-10-29T16:10:00Z'));
    const second = renderHook(() => useBusinessToday(), { wrapper: wrap(client) });

    expect(second.result.current).toBeNull();
    await waitFor(() => {
      expect(second.result.current).toBe('2026-10-30');
    });
    expect(backend.lists).toHaveLength(2);
  });

  it('keeps an unbounded hook on the held day however old it is', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });
    client = createQueryClient();
    client.setQueryData(listKey('orders', { page: 1, pageSize: 20 }), buildOrderList([], { today: '2026-10-29' }));
    vi.setSystemTime(new Date('2026-10-29T16:10:00Z'));
    const { result } = renderHook(() => useBusinessTodayState(true, null), { wrapper: wrap(client) });

    expect(result.current.today).toBe('2026-10-29');
    await settle();
    expect(backend.lists).toHaveLength(0);
  });
});

// The dashboard summary and the staff-money answer carry the server's `today` too (plan 10-15, D-20): the transfer window starts
// from it, so opening the window from the dashboard or My Money needs no extra call.
describe('answers from the dashboard and My Money (plan 10-15)', () => {
  function heldWith(setup: (held: QueryClient) => void) {
    client = createQueryClient();
    setup(client);
    const held = client;
    return renderHook(() => useBusinessToday(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={held}>{children}</QueryClientProvider>
      ),
    });
  }

  it('gives the today of a held dashboard summary with no request', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    const { result } = heldWith((held) => {
      held.setQueryData(dashboardSummaryKey, dashboardNovemberSummary());
    });

    expect(result.current).toBe('2026-11-04');
    await settle();
    expect(backend.lists).toHaveLength(0);
  });

  it('gives the today of a held staff-money answer with no request', async () => {
    const backend = useOrderHandlers({ list: standardOrderList() });
    const { result } = heldWith((held) => {
      held.setQueryData(myMoneyKey, {
        userId: MY_MONEY_USER_ID,
        name: 'Carmen Reyes',
        balance: 8450,
        today: '2026-11-05',
      });
    });

    expect(result.current).toBe('2026-11-05');
    await settle();
    expect(backend.lists).toHaveLength(0);
  });

  it('ignores a dashboard chart answer, which carries no today', async () => {
    const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-11-06' }) });
    const { result } = heldWith((held) => {
      held.setQueryData(dashboardChartKey(6), { months: [] });
    });

    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current).toBe('2026-11-06');
    });
    expect(backend.lists).toHaveLength(1);
  });
});

describe('useBusinessTodayState', () => {
  it('reports a failed call with no today, and Try Again asks again', async () => {
    let calls = 0;
    useOrderHandlers({
      list: () => {
        calls += 1;
        return calls === 1 ? orderProblem(500) : buildOrderList([], { today: '2026-10-31' });
      },
    });
    const { result } = renderToday(() => useBusinessTodayState());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.today).toBeNull();

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.today).toBe('2026-10-31');
    });
    expect(result.current.isError).toBe(false);
    expect(calls).toBe(2);
  });
});
