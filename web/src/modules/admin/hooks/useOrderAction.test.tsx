import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';

// One single-click order action (plan 08-14): a finished action must not make the next click on the same row a no-op (IN-07).

const target = { id: 'row-1' };

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function problem(status: number): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'x',
      status,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: undefined,
      errors: {},
    },
  });
}

describe('useOrderAction generation', () => {
  it('sends the next click on the same row once the success work has finished', async () => {
    const send = vi.fn(() => Promise.resolve('done'));
    const { result } = renderHook(() => useOrderAction(send, () => Promise.resolve()), { wrapper });

    await act(async () => {
      await result.current.submit(target);
    });
    await act(async () => {
      await result.current.submit(target);
    });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('still moves on when the success work throws before it returns, and passes the throw on', async () => {
    const send = vi.fn(() => Promise.resolve('done'));
    const failure = new Error('navigation failed');
    const { result } = renderHook(
      () =>
        useOrderAction(send, () => {
          throw failure;
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.submit(target)).rejects.toBe(failure);
    });
    await act(async () => {
      await expect(result.current.submit(target)).rejects.toBe(failure);
    });

    expect(send).toHaveBeenCalledTimes(2);
  });
});

// WR-01: a failure that may have saved leaves the order, the lists, the staff money and the dashboard old, so a success's reads run.

describe('a failure that may have saved', () => {
  function holdAnswers(): readonly (readonly unknown[])[] {
    const keys = [orderKey('order-1'), ordersKey, staffMoneyKey, dashboardKey];
    keys.forEach((key) => {
      queryClient.setQueryData(key, { held: true });
    });
    return keys;
  }

  const invalidated = (key: readonly unknown[]): boolean => queryClient.getQueryState(key)?.isInvalidated ?? false;

  async function fail(rejection: Error): Promise<void> {
    const send = vi.fn(() => Promise.reject(rejection));
    const { result } = renderHook(() => useOrderAction(send, () => Promise.resolve()), { wrapper });
    await act(async () => {
      await result.current.submit(target).catch(() => undefined);
    });
  }

  it.each([
    ['a server error', problem(500)],
    ['a timeout', problem(408)],
    ['no answer', new Error('Failed to fetch')],
  ])('reads the order, the lists, the staff money and the dashboard again after %s', async (_name, rejection) => {
    const keys = holdAnswers();

    await fail(rejection);

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it.each([400, 404, 409])('reads nothing again after a %i, which saved nothing', async (status) => {
    const keys = holdAnswers();

    await fail(problem(status));

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(false);
    });
  });
});
