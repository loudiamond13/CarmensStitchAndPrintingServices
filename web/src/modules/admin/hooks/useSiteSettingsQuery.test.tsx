import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  siteSettingsKey,
  useSiteSettingsQuery,
  useUpdateSiteSettings,
} from '@/modules/admin/hooks/useSiteSettingsQuery';
import type { UpdateSiteSettingsRequest } from '@/modules/admin/services/siteSettingsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { createDeferred } from '@/test/fakeFetch';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoSiteSettings, problemAnswer, siteSettingsBackend, versionAfter } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The staff read of the site settings and the save hook (CONT-01, PUB-03; plan 11-12).

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

const body: UpdateSiteSettingsRequest = {
  version: demoSiteSettings.version,
  businessName: demoSiteSettings.businessName,
  tagline: 'A new tagline',
  aboutText: demoSiteSettings.aboutText,
  turnaroundLine: null,
  street: demoSiteSettings.street,
  townOrCity: demoSiteSettings.townOrCity,
  province: demoSiteSettings.province,
  postalCode: demoSiteSettings.postalCode,
  directionsUrl: demoSiteSettings.directionsUrl,
  mapEmbedUrl: demoSiteSettings.mapEmbedUrl,
  messengerUrl: demoSiteSettings.messengerUrl,
  facebookUrl: demoSiteSettings.facebookUrl,
  instagramUrl: demoSiteSettings.instagramUrl,
  tiktokUrl: null,
  contactEmail: demoSiteSettings.contactEmail,
  phones: demoSiteSettings.phones,
};

describe('useSiteSettingsQuery', () => {
  it('reads GET /api/v1/site-settings once under the site-settings key', async () => {
    const backend = siteSettingsBackend();
    const { result } = renderHook(() => useSiteSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(demoSiteSettings);
    expect(backend.gets).toBe(1);
    expect(siteSettingsKey).toEqual(['site-settings']);
    expect(queryClient.getQueryData(siteSettingsKey)).toEqual(demoSiteSettings);
  });

  it('reports a failed read as an error', async () => {
    server.use(http.get('*/api/v1/site-settings', () => problemAnswer(500)));
    const { result } = renderHook(() => useSiteSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useUpdateSiteSettings', () => {
  it('saves with PUT, puts the answer in the cache and clears the public data in this browser', async () => {
    const backend = siteSettingsBackend();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateSiteSettings({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit(body);
    });

    expect(backend.puts).toEqual([body]);
    expect(onSuccess).toHaveBeenCalledOnce();
    const cached = queryClient.getQueryData<typeof demoSiteSettings>(siteSettingsKey);
    expect(cached?.tagline).toBe('A new tagline');
    expect(cached?.version).toBe(versionAfter(1));
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('on a stale save changes nothing in the cache, clears nothing and hands the failure on', async () => {
    siteSettingsBackend(demoSiteSettings, {
      onPut: () => problemAnswer(409, { code: 'edit.stale' }),
    });
    queryClient.setQueryData(siteSettingsKey, demoSiteSettings);
    const onFailure = vi.fn();
    const { result } = renderHook(() => useUpdateSiteSettings({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit(body);
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 409, code: 'edit.stale' });
    expect(queryClient.getQueryData(siteSettingsKey)).toEqual(demoSiteSettings);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('sends the body exactly once while a save is pending, however often it is pressed', async () => {
    const gate = createDeferred<undefined>();
    const backend = siteSettingsBackend(demoSiteSettings, {
      onPut: async () => {
        await gate.promise;
        return undefined;
      },
    });
    const { result } = renderHook(() => useUpdateSiteSettings(), { wrapper });

    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.submit(body);
      void result.current.submit(body);
    });
    gate.resolve(undefined);
    await act(async () => {
      await first;
    });

    expect(backend.puts).toHaveLength(1);
  });
});
