import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import type { ResolverOptions, ResolverResult } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  freshCapResolver,
  useOrderWindowFigures,
  type OrderWindowFigures,
} from '@/modules/admin/hooks/useOrderWindowFigures';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { buildOrderDetail, order0148, useOrderHandlers } from '@/test/orderFixtures';

// The figures an order window checks against (D-95; plan 08-26): the newest answer the page holds, read again when the tab regains
// focus or a check fails, and the opened order when nothing is held.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  focusManager.setFocused(undefined);
  queryClient.clear();
});

const HELD_FOR = 5_000;
const NEWER = buildOrderDetail({
  version: 'AAAAAAAAB9F=',
  totals: { ...order0148.totals, paid: 10000, balance: 11327.5 },
});

function hold(order: OrderDetailResponse, age = HELD_FOR): void {
  queryClient.setQueryData(orderKey(order.id), order, { updatedAt: Date.now() - age });
}

function renderFigures(opened: OrderDetailResponse = order0148) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useOrderWindowFigures(opened), { wrapper });
}

describe('useOrderWindowFigures', () => {
  it('is the opened order when nothing is held for it', () => {
    useOrderHandlers({ detail: () => new Promise<never>(() => undefined) });
    const { result } = renderFigures();

    expect(result.current.current).toBe(order0148);
    expect(result.current.latest()).toBe(order0148);
  });

  it('is the order the page holds', () => {
    useOrderHandlers({ detail: NEWER });
    hold(NEWER);
    const { result } = renderFigures();

    expect(result.current.current).toEqual(NEWER);
    expect(result.current.latest()).toEqual(NEWER);
  });

  it('reads the order again when the tab regains focus, even though the page data counts as fresh', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    hold(order0148);
    const { result } = renderFigures();
    expect(backend.reads).toEqual([]);

    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });

    await waitFor(() => {
      expect(result.current.current).toEqual(NEWER);
    });
    expect(backend.reads).toEqual([order0148.id]);
  });

  it('refresh reads the order now, holds it and returns it', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    hold(order0148);
    const { result } = renderFigures();

    let fresh: OrderDetailResponse | null = null;
    await act(async () => {
      fresh = await result.current.refresh();
    });

    expect(fresh).toEqual(NEWER);
    expect(backend.reads).toEqual([order0148.id]);
    expect(result.current.latest()).toEqual(NEWER);
  });

  it('refresh gives null for a failed read and leaves the held figures alone', async () => {
    useOrderHandlers({ detail: () => new HttpResponse(null, { status: 500 }) });
    hold(order0148);
    const { result } = renderFigures();

    let fresh: OrderDetailResponse | null = NEWER;
    await act(async () => {
      fresh = await result.current.refresh();
    });

    expect(fresh).toBeNull();
    expect(result.current.current).toEqual(order0148);
    expect(result.current.latest()).toEqual(order0148);
  });

  it('refresh shares one read with a second call inside a second', async () => {
    const backend = useOrderHandlers({ detail: NEWER });
    hold(order0148);
    const { result } = renderFigures();

    await act(async () => {
      await result.current.refresh();
      await result.current.refresh();
    });

    expect(backend.reads).toHaveLength(1);
  });
});

describe('freshCapResolver', () => {
  interface Values {
    amount: string;
  }
  const options = {} as ResolverOptions<Values>;
  const passes: ResolverResult<Values, Values> = { values: { amount: '1' }, errors: {} };
  const refused: ResolverResult<Values, Values> = {
    values: {},
    errors: { amount: { type: 'custom', message: 'over' } },
  };

  function figures(fresh: OrderDetailResponse | null): OrderWindowFigures & { refreshed: ReturnType<typeof vi.fn> } {
    const refreshed = vi.fn(() => Promise.resolve(fresh));
    return { current: order0148, latest: () => order0148, refresh: refreshed, refreshed };
  }

  it('reads nothing when the held figures allow the values', async () => {
    const held = figures(NEWER);
    const resolver = freshCapResolver<Values, Values>({
      figures: held,
      resolverFor: () => () => passes,
      overCap: () => true,
    });

    expect(await resolver({ amount: '1' }, undefined, options)).toBe(passes);
    expect(held.refreshed).not.toHaveBeenCalled();
  });

  it('reads nothing when the values fail for a reason other than the cap', async () => {
    const held = figures(NEWER);
    const resolver = freshCapResolver<Values, Values>({
      figures: held,
      resolverFor: () => () => refused,
      overCap: () => false,
    });

    expect(await resolver({ amount: '1' }, undefined, options)).toBe(refused);
    expect(held.refreshed).not.toHaveBeenCalled();
  });

  it('reads once on a cap failure and answers with the check on the fresh order', async () => {
    const held = figures(NEWER);
    const checked: OrderDetailResponse[] = [];
    const resolver = freshCapResolver<Values, Values>({
      figures: held,
      resolverFor: (order) => () => {
        checked.push(order);
        return order === NEWER ? passes : refused;
      },
      overCap: () => true,
    });

    expect(await resolver({ amount: '1' }, undefined, options)).toBe(passes);
    expect(held.refreshed).toHaveBeenCalledTimes(1);
    expect(checked).toEqual([order0148, NEWER]);
  });

  it('keeps the first answer when the read fails', async () => {
    const held = figures(null);
    const resolver = freshCapResolver<Values, Values>({
      figures: held,
      resolverFor: () => () => refused,
      overCap: () => true,
    });

    expect(await resolver({ amount: '1' }, undefined, options)).toBe(refused);
    expect(held.refreshed).toHaveBeenCalledTimes(1);
  });
});
