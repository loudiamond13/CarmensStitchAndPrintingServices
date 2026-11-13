import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  siteSettingsKey,
  useRemoveSharePicture,
  useSiteSettingsQuery,
  useUpdateSiteSettings,
  useUploadSharePicture,
} from '@/modules/admin/hooks/useSiteSettingsQuery';
import { HttpError } from '@/core/api/errors';
import { siteSettingsService, type UpdateSiteSettingsRequest } from '@/modules/admin/services/siteSettingsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { createDeferred } from '@/test/fakeFetch';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoSiteSettings,
  pictureVersionAfter,
  problemAnswer,
  sharePicture,
  sharePictureBackend,
  siteSettingsBackend,
  versionAfter,
} from '@/test/siteContentFixtures';

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
  vi.restoreAllMocks();
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

describe('useUploadSharePicture (PUB-04, D-26; plan 11-34)', () => {
  const file = () => new File(['jpeg'], 'shop.jpg', { type: 'image/jpeg' });

  it('posts with one Idempotency-Key, reads the settings again, puts them in the cache and clears the public data in this browser', async () => {
    const settings = siteSettingsBackend();
    const pictures = sharePictureBackend(settings);
    queryClient.setQueryData(siteSettingsKey, demoSiteSettings);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUploadSharePicture({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit(file());
    });

    expect(pictures.uploads).toHaveLength(1);
    expect(pictures.uploads[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(settings.gets).toBe(1);
    const cached = queryClient.getQueryData<typeof demoSiteSettings>(siteSettingsKey);
    expect(cached?.sharePicture).toEqual(sharePicture('upload-1'));
    expect(cached?.version).toBe(pictureVersionAfter(1));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess.mock.calls[0]?.[0]).toEqual(cached);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a refused picture reads nothing again, clears nothing and hands the failure on', async () => {
    const settings = siteSettingsBackend();
    // The refusal is raised by the service: a refusal sent before the browser's form body is out ends as a transport error in this test run.
    vi.spyOn(siteSettingsService, 'uploadSharePicture').mockRejectedValue(
      new HttpError({
        kind: 'http',
        status: 400,
        problem: {
          type: undefined,
          title: 'x',
          status: 400,
          detail: undefined,
          instance: undefined,
          traceId: undefined,
          code: 'images.type',
          errors: {},
        },
      }),
    );
    queryClient.setQueryData(siteSettingsKey, demoSiteSettings);
    const onFailure = vi.fn();
    const { result } = renderHook(() => useUploadSharePicture({ onFailure }), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(file());
    });

    expect(outcome?.ok).toBe(false);
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 400, code: 'images.type' });
    expect(settings.gets).toBe(0);
    expect(queryClient.getQueryData(siteSettingsKey)).toEqual(demoSiteSettings);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('a picture that went up still counts when the settings cannot be read again: the answer is null and the settings are marked for a new read', async () => {
    const settings = siteSettingsBackend();
    sharePictureBackend(settings);
    queryClient.setQueryData(siteSettingsKey, demoSiteSettings);
    server.use(http.get('*/api/v1/site-settings', () => problemAnswer(500)));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUploadSharePicture({ onSuccess }), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(file());
    });

    expect(outcome?.ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(null, expect.anything());
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    expect(queryClient.getQueryState(siteSettingsKey)?.isInvalidated).toBe(true);
  });

  it('choosing the same file again after it went up is a new upload with a new key', async () => {
    const settings = siteSettingsBackend();
    const pictures = sharePictureBackend(settings);
    const { result } = renderHook(() => useUploadSharePicture(), { wrapper });
    const picked = file();

    await act(async () => {
      await result.current.submit(picked);
    });
    await act(async () => {
      await result.current.submit(picked);
    });

    expect(pictures.uploads).toHaveLength(2);
    expect(pictures.uploads[0]?.key).not.toBe(pictures.uploads[1]?.key);
  });
});

describe('useRemoveSharePicture (PUB-04, D-26; plan 11-34)', () => {
  it('deletes, reads the settings again, puts them in the cache and clears the public data in this browser', async () => {
    const settings = siteSettingsBackend({ ...demoSiteSettings, sharePicture: sharePicture() });
    const pictures = sharePictureBackend(settings);
    queryClient.setQueryData(siteSettingsKey, settings.current);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRemoveSharePicture({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit();
    });

    expect(pictures.removals).toBe(1);
    expect(settings.gets).toBe(1);
    const cached = queryClient.getQueryData<typeof demoSiteSettings>(siteSettingsKey);
    expect(cached?.sharePicture).toBeNull();
    expect(cached?.version).toBe(pictureVersionAfter(1));
    expect(onSuccess.mock.calls[0]?.[0]).toEqual(cached);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a picture that is already gone (404) counts as removed: the settings are read again and the public data cleared', async () => {
    const settings = siteSettingsBackend();
    sharePictureBackend(settings, {
      onRemove: () => problemAnswer(404, { code: 'site-settings.share-picture-not-found' }),
    });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRemoveSharePicture({ onSuccess }), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome?.ok).toBe(true);
    expect(settings.gets).toBe(1);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a failed removal reads nothing again, clears nothing and hands the failure on', async () => {
    const settings = siteSettingsBackend();
    sharePictureBackend(settings, { onRemove: () => problemAnswer(500) });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useRemoveSharePicture({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit();
    });

    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 500 });
    expect(settings.gets).toBe(0);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});
