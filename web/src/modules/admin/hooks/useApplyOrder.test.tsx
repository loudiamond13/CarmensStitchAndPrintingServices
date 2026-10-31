import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { useApplyOrder } from '@/modules/admin/hooks/useApplyOrder';
import { orderExpenseCategoriesKey } from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { paymentMethodsKey } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { productTypesKey } from '@/modules/admin/hooks/useProductTypesQuery';
import { ordersDeletedKey } from '@/modules/admin/hooks/useRefreshOrders';
import { buildOrderDetail, order0148, order0151 } from '@/test/orderFixtures';

// Every order write answers the whole order: the page takes that answer, and every list that shows the order is read again
// (RESEARCH Pattern 4, T-08-20). No figure is worked out in the browser.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderApply() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useApplyOrder(), { wrapper });
}

/** Holds a value under a key, so a later invalidation can be seen on it. */
function hold(key: readonly unknown[]): void {
  queryClient.setQueryData(key, { held: true });
}

function invalidated(key: readonly unknown[]): boolean {
  return queryClient.getQueryState(key)?.isInvalidated ?? false;
}

describe('useApplyOrder', () => {
  it("writes the server's answer into the order query", () => {
    const { result } = renderApply();
    const answer = buildOrderDetail({ status: 'ready', version: 'AAAAAAAAB9F=' });

    result.current(answer);

    expect(queryClient.getQueryData(orderKey(answer.id))).toEqual(answer);
  });

  it('replaces an order already held with the newer answer', () => {
    queryClient.setQueryData(orderKey(order0148.id), order0148);
    const { result } = renderApply();
    const newer = buildOrderDetail({ version: 'AAAAAAAAB9G=' });

    result.current(newer);

    expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(newer);
  });

  it('invalidates the order lists, the deleted list and the three list-entry queries', () => {
    const keys = [
      [...ordersKey, { page: 1 }],
      [...ordersDeletedKey, { page: 1 }],
      productTypesKey,
      paymentMethodsKey,
      orderExpenseCategoriesKey,
    ];
    keys.forEach(hold);
    const { result } = renderApply();

    result.current(order0148);

    keys.forEach((key) => {
      expect(invalidated(key), JSON.stringify(key)).toBe(true);
    });
  });

  it('leaves another order and unrelated queries alone', () => {
    const other = orderKey(order0151.id);
    const unrelated = ['company-expenses', { page: 1 }];
    hold(other);
    hold(unrelated);
    const { result } = renderApply();

    result.current(order0148);

    expect(invalidated(other)).toBe(false);
    expect(invalidated(unrelated)).toBe(false);
    expect(queryClient.getQueryData(other)).toEqual({ held: true });
  });

  it('does not invalidate the order it just wrote', () => {
    const { result } = renderApply();

    result.current(order0148);

    expect(invalidated(orderKey(order0148.id))).toBe(false);
  });
});
