import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { useExpenseAction } from '@/modules/admin/hooks/useExpenseAction';
import { expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';

// WR-01: a delete, restore or purge that may have run leaves the lists, the staff money and the dashboard old, so a success's reads run.

const target = { id: 'expense-1' };

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

function holdAnswers(): readonly (readonly unknown[])[] {
  const keys = [expensesKey, staffMoneyKey, dashboardKey];
  keys.forEach((key) => {
    queryClient.setQueryData(key, { held: true });
  });
  return keys;
}

const invalidated = (key: readonly unknown[]): boolean => queryClient.getQueryState(key)?.isInvalidated ?? false;

async function fail(rejection: Error): Promise<void> {
  const send = vi.fn(() => Promise.reject(rejection));
  const { result } = renderHook(() => useExpenseAction(send, () => Promise.resolve()), { wrapper });
  await act(async () => {
    await result.current.submit(target).catch(() => undefined);
  });
}

describe('useExpenseAction after a failure that may have saved', () => {
  it.each([
    ['a server error', problem(500)],
    ['a timeout', problem(408)],
    ['no answer', new Error('Failed to fetch')],
  ])('reads the lists, the staff money and the dashboard again after %s', async (_name, rejection) => {
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
