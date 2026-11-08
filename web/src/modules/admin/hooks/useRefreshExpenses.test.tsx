import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { dashboardChartKey, useDashboardChartQuery } from '@/modules/admin/hooks/useDashboardChartQuery';
import { dashboardSummaryKey, useDashboardSummaryQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { expensesDeletedKey } from '@/modules/admin/hooks/useDeletedExpensesQuery';
import { expenseCategoriesKey } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { expenseKpisKey } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { myMoneyKey, staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { moneyTransfersKey, transferRecipientsKey } from '@/modules/admin/hooks/useTransferRecipientsQuery';
import { useRefreshCategories } from '@/modules/admin/hooks/useRefreshCategories';
import { useRefreshExpenses } from '@/modules/admin/hooks/useRefreshExpenses';
import { dashboardBackend } from '@/test/dashboardFixtures';

// Every company expense write reads the dashboard again (D-13), besides the four expense keys it already refreshed: the month
// expenses figure, the chart and the Company expenses foot all change with an expense.

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

/** Holds a value under a key, so a later invalidation can be seen on it. */
function hold(key: readonly unknown[]): void {
  queryClient.setQueryData(key, { held: true });
}

function invalidated(key: readonly unknown[]): boolean {
  return queryClient.getQueryState(key)?.isInvalidated ?? false;
}

describe('useRefreshExpenses (D-13)', () => {
  it('invalidates the dashboard summary and every chart range', async () => {
    const keys = [dashboardSummaryKey, dashboardChartKey(6), dashboardChartKey(12)];
    keys.forEach(hold);
    const { result } = renderHook(() => useRefreshExpenses(), { wrapper });

    await result.current();

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('still invalidates the four expense keys it refreshed before', async () => {
    const keys = [
      [...expenseKpisKey, { month: '2026-10' }],
      [...expensesDeletedKey, { page: 1 }],
      [...expensesKey, { page: 1 }],
      expenseCategoriesKey,
    ];
    keys.forEach(hold);
    const { result } = renderHook(() => useRefreshExpenses(), { wrapper });

    await result.current();

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('also invalidates the staff-money and money-transfers answers, because an expense changes the payer balance', async () => {
    const keys = [
      myMoneyKey,
      [...staffMoneyKey, 'ledger', { page: 1 }],
      transferRecipientsKey,
      [...moneyTransfersKey, { page: 1 }],
    ];
    keys.forEach(hold);
    const { result } = renderHook(() => useRefreshExpenses(), { wrapper });

    await result.current();

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('leaves unrelated queries alone', async () => {
    const unrelated = ['orders', { page: 1 }];
    hold(unrelated);
    const { result } = renderHook(() => useRefreshExpenses(), { wrapper });

    await result.current();

    expect(invalidated(unrelated)).toBe(false);
  });

  it('reads the dashboard summary and the chart again while the dashboard is on screen', async () => {
    const backend = dashboardBackend();
    const { result } = renderHook(
      () => ({ summary: useDashboardSummaryQuery(), chart: useDashboardChartQuery(6), refresh: useRefreshExpenses() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.summary.isSuccess && result.current.chart.isSuccess).toBe(true);
    });

    await result.current.refresh();

    await waitFor(() => {
      expect(backend.calls).toHaveLength(2);
      expect(backend.chartCalls).toHaveLength(2);
    });
  });

  it('a category change reaches the dashboard too, because the category refresh is the expense refresh', async () => {
    hold(dashboardSummaryKey);
    const { result } = renderHook(() => useRefreshCategories(), { wrapper });

    await result.current();

    expect(invalidated(dashboardSummaryKey)).toBe(true);
  });
});
