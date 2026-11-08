import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { dashboardChartKey } from '@/modules/admin/hooks/useDashboardChartQuery';
import { dashboardKey, dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { myMoneyKey, staffMoneyKey, useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { useRefreshExpenses } from '@/modules/admin/hooks/useRefreshExpenses';
import { useRefreshMoney } from '@/modules/admin/hooks/useRefreshMoney';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { moneyTransfersKey, transferRecipientsKey } from '@/modules/admin/hooks/useTransferRecipientsQuery';
import { myMoneyBackend, myMoneyFixture } from '@/test/moneyFixtures';

// A transfer changes balances, so the staff-money answers, the transfer lists and the dashboard are read again (D-13; plan 10-15).

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

const MONEY_KEYS = [
  myMoneyKey,
  [...staffMoneyKey, 'ledger', { page: 1 }],
  transferRecipientsKey,
  [...moneyTransfersKey, { page: 1 }],
];
const DASHBOARD_KEYS = [dashboardSummaryKey, dashboardChartKey(6), dashboardChartKey(12)];

describe('useRefreshMoney', () => {
  it('invalidates the staff-money, money-transfers and dashboard roots', async () => {
    [...MONEY_KEYS, ...DASHBOARD_KEYS].forEach(hold);
    const { result } = renderHook(() => useRefreshMoney(), { wrapper });

    await result.current();

    [...MONEY_KEYS, ...DASHBOARD_KEYS].forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('uses the roots every money query sits under', () => {
    expect(staffMoneyKey).toEqual(['staff-money']);
    expect(moneyTransfersKey).toEqual(['money-transfers']);
    expect(dashboardKey).toEqual(['dashboard']);
    expect(myMoneyKey.slice(0, 1)).toEqual(staffMoneyKey);
    expect(transferRecipientsKey.slice(0, 1)).toEqual(moneyTransfersKey);
  });

  it('leaves unrelated queries alone', async () => {
    const unrelated = ['orders', { page: 1 }];
    hold(unrelated);
    const { result } = renderHook(() => useRefreshMoney(), { wrapper });

    await result.current();

    expect(invalidated(unrelated)).toBe(false);
  });

  it('reads the money again while it is on screen', async () => {
    const calls = myMoneyBackend(myMoneyFixture());
    const { result } = renderHook(() => ({ money: useMyMoneyQuery(), refresh: useRefreshMoney() }), { wrapper });
    await waitFor(() => {
      expect(result.current.money.isSuccess).toBe(true);
    });
    expect(calls).toHaveLength(1);

    await result.current.refresh();

    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
  });
});

describe('a transfer, a payment and an expense each read the dashboard and the money again (D-13)', () => {
  it.each([
    ['a transfer', useRefreshMoney],
    ['an order, item, payment, refund or order expense write', useRefreshOrders],
    ['a company expense write', useRefreshExpenses],
  ])('%s', async (_what, useRefresh) => {
    [...MONEY_KEYS, ...DASHBOARD_KEYS].forEach(hold);
    const { result } = renderHook(() => useRefresh(), { wrapper });

    await result.current();

    [...MONEY_KEYS, ...DASHBOARD_KEYS].forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });
});
