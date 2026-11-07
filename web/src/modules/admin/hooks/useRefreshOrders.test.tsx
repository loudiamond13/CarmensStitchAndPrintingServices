import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  dashboardKey,
  dashboardSummaryKey,
  useDashboardSummaryQuery,
} from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { dashboardChartKey, useDashboardChartQuery } from '@/modules/admin/hooks/useDashboardChartQuery';
import { orderExpenseCategoriesKey } from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { paymentMethodsKey } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { productTypesKey } from '@/modules/admin/hooks/useProductTypesQuery';
import { ordersDeletedKey, useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { dashboardBackend } from '@/test/dashboardFixtures';

// Every order, item, payment, refund, discount and order expense write reads the dashboard again (D-13), besides the keys it
// already refreshed. useApplyOrder routes every order write through this hook.

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

describe('useRefreshOrders (D-13)', () => {
  it('invalidates the dashboard summary and every chart range', async () => {
    const keys = [dashboardSummaryKey, dashboardChartKey(6), dashboardChartKey(12)];
    keys.forEach(hold);
    const { result } = renderHook(() => useRefreshOrders(), { wrapper });

    await result.current();

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('still invalidates every key it refreshed before', async () => {
    const keys = [
      [...ordersKey, { page: 1 }],
      [...ordersDeletedKey, { page: 1 }],
      productTypesKey,
      paymentMethodsKey,
      orderExpenseCategoriesKey,
    ];
    keys.forEach(hold);
    const { result } = renderHook(() => useRefreshOrders(), { wrapper });

    await result.current();

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('leaves unrelated queries alone', async () => {
    const unrelated = ['company-expenses', { page: 1 }];
    hold(unrelated);
    const { result } = renderHook(() => useRefreshOrders(), { wrapper });

    await result.current();

    expect(invalidated(unrelated)).toBe(false);
  });

  it('reads the dashboard summary and the chart again while the dashboard is on screen', async () => {
    const backend = dashboardBackend();
    const { result } = renderHook(
      () => ({ summary: useDashboardSummaryQuery(), chart: useDashboardChartQuery(6), refresh: useRefreshOrders() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.summary.isSuccess && result.current.chart.isSuccess).toBe(true);
    });
    expect(backend.calls).toHaveLength(1);
    expect(backend.chartCalls).toHaveLength(1);

    await result.current.refresh();

    await waitFor(() => {
      expect(backend.calls).toHaveLength(2);
      expect(backend.chartCalls).toHaveLength(2);
    });
  });

  it('uses the root key that every dashboard query sits under', () => {
    expect(dashboardKey).toEqual(['dashboard']);
    expect(dashboardSummaryKey.slice(0, 1)).toEqual(dashboardKey);
    expect(dashboardChartKey(12).slice(0, 1)).toEqual(dashboardKey);
  });
});
