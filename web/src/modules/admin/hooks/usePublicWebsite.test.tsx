import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { useProductLineOptionsQuery, useSavePublicWebsite } from '@/modules/admin/hooks/usePublicWebsite';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  buildOrderDetail,
  order0148,
  ORDER_VERSION,
  PRODUCT_LINE_OPTIONS,
  publicWebsiteBlock,
  useOrderHandlers,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The reads and the save behind the Public Website window (GAL-03, CONT-03; plan 11-27).

const LINE = '8c1f4a20-0000-4000-8000-000000000001';

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('useProductLineOptionsQuery', () => {
  it('reads the active lines the window offers', async () => {
    useOrderHandlers();

    const { result } = renderHook(() => useProductLineOptionsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(PRODUCT_LINE_OPTIONS);
    });
  });

  it('asks for nothing while the window is closed', () => {
    const backend = useOrderHandlers();

    const { result } = renderHook(() => useProductLineOptionsQuery(false), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(backend.reads).toEqual([]);
  });
});

describe('useSavePublicWebsite', () => {
  const shownAnswer = buildOrderDetail({
    publicWebsite: publicWebsiteBlock({
      customerConsent: true,
      consentRecordedAtUtc: '2026-10-08T03:00:00Z',
      consentRecordedByName: 'Liza Mercado',
      shownOnWebsite: true,
      shownSinceUtc: '2026-10-08T03:00:00Z',
      productLineId: LINE,
      productLineTitle: 'Basketball Jerseys',
      hasPhoto: true,
    }),
    version: 'AAAAAAAAB9F=',
  });

  it('sends the order version and the choices, sets the order from the answer and shows the toast', async () => {
    const backend = useOrderHandlers({ detail: shownAnswer });
    queryClient.setQueryData(orderKey(order0148.id), order0148);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSavePublicWebsite({ order: order0148, onSaved }), { wrapper });

    act(() => {
      result.current.submit({
        values: { customerConsent: true, showOnWebsite: true, productLineId: LINE, publicName: '' },
        version: ORDER_VERSION,
      });
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.method).toBe('PUT');
    expect(backend.writes[0]?.path).toBe(`/orders/${order0148.id}/public`);
    expect(backend.writes[0]?.body).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: LINE,
      publicName: null,
      version: ORDER_VERSION,
    });
    expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(shownAnswer);
    expect(await screen.findByText('Order shown on the website')).toBeVisible();
  });
});
