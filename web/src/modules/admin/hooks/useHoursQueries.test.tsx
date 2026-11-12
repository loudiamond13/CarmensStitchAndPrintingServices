import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  openingHoursKey,
  useOpeningHoursQuery,
  useUpdateOpeningHours,
} from '@/modules/admin/hooks/useOpeningHoursQuery';
import type { UpdateOpeningHoursRequest } from '@/modules/admin/services/openingHoursService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoOpeningHours, hoursVersionAfter, openingHoursBackend, problemAnswer } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The staff read of the weekly hours and the save hook (CONT-01, PUB-03; plan 11-16).

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const body: UpdateOpeningHoursRequest = {
  version: demoOpeningHours.version,
  days: demoOpeningHours.days.map((day) => (day.day === 7 ? { day: 7, opensAt: '10:00', closesAt: '15:00' } : day)),
};

describe('useOpeningHoursQuery', () => {
  it('reads GET /api/v1/opening-hours once under the opening-hours key', async () => {
    const backend = openingHoursBackend();
    const { result } = renderHook(() => useOpeningHoursQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(demoOpeningHours);
    expect(backend.gets).toBe(1);
    expect(openingHoursKey).toEqual(['opening-hours']);
  });

  it('reports a failed read as an error', async () => {
    server.use(http.get('*/api/v1/opening-hours', () => problemAnswer(500)));
    const { result } = renderHook(() => useOpeningHoursQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useUpdateOpeningHours', () => {
  it('saves with PUT, puts the answer in the cache and clears the public data in this browser', async () => {
    const backend = openingHoursBackend();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateOpeningHours({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit(body);
    });

    expect(backend.puts).toEqual([body]);
    expect(onSuccess).toHaveBeenCalledOnce();
    const cached = queryClient.getQueryData<typeof demoOpeningHours>(openingHoursKey);
    expect(cached?.version).toBe(hoursVersionAfter(1));
    expect(cached?.days.find((day) => day.day === 7)?.opensAt).toBe('10:00');
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('on a stale save changes nothing in the cache, clears nothing and hands the failure on', async () => {
    openingHoursBackend(demoOpeningHours, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    queryClient.setQueryData(openingHoursKey, demoOpeningHours);
    const onFailure = vi.fn();
    const { result } = renderHook(() => useUpdateOpeningHours({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit(body);
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 409, code: 'edit.stale' });
    expect(queryClient.getQueryData(openingHoursKey)).toEqual(demoOpeningHours);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});
