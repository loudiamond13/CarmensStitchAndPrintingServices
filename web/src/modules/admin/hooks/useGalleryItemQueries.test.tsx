import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  galleryItemsKey,
  useCreateGalleryUpload,
  useDeleteGalleryUpload,
  useGalleryItemsQuery,
  useMoveGalleryItem,
  useReadGalleryAgain,
  useReplaceGalleryPhoto,
  useSetGalleryUploadShown,
  useUpdateGalleryUpload,
} from '@/modules/admin/hooks/useGalleryItemQueries';
import { productLinesKey } from '@/modules/admin/hooks/useProductLineQueries';
import type { GalleryAddForm, GalleryUploadRequest } from '@/modules/admin/services/galleryItemsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import { GALLERY_IDS, galleryItemsBackend, LINE_IDS, problemAnswer } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The staff read of the gallery and its writes (GAL-03, PUB-03; plan 11-32).

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

const PARAMS = { line: null, page: 1, pageSize: 20 } as const;

const form: GalleryAddForm = {
  file: new Blob(['jpeg'], { type: 'image/jpeg' }),
  fileName: 'riders.jpg',
  teamName: 'Sample New Upload',
  productLineId: LINE_IDS.moto,
  pieces: 12,
  note: '',
  isShown: true,
};

const body: GalleryUploadRequest = {
  teamName: 'Sample Barangay Riders',
  productLineId: LINE_IDS.moto,
  pieces: 12,
  note: '',
  isShown: true,
  version: 'AAAAAAAAH01=',
};

describe('useGalleryItemsQuery', () => {
  it('reads one page under the gallery-items key, every item in gallery order, with the page and size asked for', async () => {
    const backend = galleryItemsBackend();
    const { result } = renderHook(() => useGalleryItemsQuery({ line: LINE_IDS.moto, page: 1, pageSize: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.rows.map((row) => row.name)).toEqual(['Sample Barangay Riders', 'Sample Riders MC']);
    expect(result.current.data?.total).toBe(2);
    expect(backend.gets).toEqual([{ line: LINE_IDS.moto, page: '1', pageSize: '10' }]);
    expect(galleryItemsKey).toEqual(['gallery-items']);
  });

  it('keeps the rows of the page it had while the next page loads', async () => {
    galleryItemsBackend();
    const { result, rerender } = renderHook(({ page }) => useGalleryItemsQuery({ line: null, page, pageSize: 10 }), {
      wrapper,
      initialProps: { page: 1 },
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    rerender({ page: 2 });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.page).toBe(1);
  });

  it('reports a failed read as an error', async () => {
    server.use(http.get('*/api/v1/gallery-items', () => problemAnswer(500)));
    const { result } = renderHook(() => useGalleryItemsQuery(PARAMS), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useReadGalleryAgain', () => {
  it('reads the page from the server now and gives it back', async () => {
    const backend = galleryItemsBackend();
    const { result } = renderHook(() => useReadGalleryAgain(PARAMS), { wrapper });

    let page: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      page = await result.current();
    });

    expect(page?.rows).toHaveLength(6);
    expect(backend.gets).toHaveLength(1);
  });
});

describe('useCreateGalleryUpload', () => {
  it('adds with POST and one Idempotency-Key, then reads the lists again and clears the public data in this browser', async () => {
    const backend = galleryItemsBackend();
    queryClient.setQueryData(galleryItemsKey, []);
    queryClient.setQueryData(productLinesKey, []);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateGalleryUpload({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit(form);
    });

    expect(backend.posts).toHaveLength(1);
    expect(backend.posts[0]?.key).toMatch(/\S/);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(queryClient.getQueryState(galleryItemsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(productLinesKey)?.isInvalidated).toBe(true);
    });
  });

  it('a refused add clears nothing and hands the failure on', async () => {
    galleryItemsBackend(undefined, {
      onPost: () => problemAnswer(400, { errors: { teamName: ['Enter the team or name.'] } }),
    });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useCreateGalleryUpload({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit(form);
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 400 });
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('useUpdateGalleryUpload and useReplaceGalleryPhoto', () => {
  it('saves with PUT and the version, then clears the public data', async () => {
    const backend = galleryItemsBackend();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateGalleryUpload({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.newUpload, body });
    });

    expect(backend.puts).toEqual([{ id: GALLERY_IDS.newUpload, body }]);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('on a stale save clears nothing and hands the failure on', async () => {
    galleryItemsBackend(undefined, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useUpdateGalleryUpload({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.newUpload, body });
    });

    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 409, code: 'edit.stale' });
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('replaces the photo with POST and one Idempotency-Key and gives back the item with its new version', async () => {
    const backend = galleryItemsBackend();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useReplaceGalleryPhoto({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.newUpload, file: form.file, fileName: 'new.jpg' });
    });

    expect(backend.photos).toHaveLength(1);
    expect(backend.photos[0]?.key).toMatch(/\S/);
    expect((onSuccess.mock.calls[0]?.[0] as { version: string }).version).toMatch(/^AAAAAAAAH/);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });
});

describe('useMoveGalleryItem, useSetGalleryUploadShown and useDeleteGalleryUpload', () => {
  it('moves with the direction, the line and one Idempotency-Key, then clears the public data', async () => {
    const backend = galleryItemsBackend();
    const { result } = renderHook(() => useMoveGalleryItem(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.ballers, direction: 'up', lineId: LINE_IDS.basketball });
    });

    expect(backend.moves).toHaveLength(1);
    expect(backend.moves[0]).toMatchObject({ id: GALLERY_IDS.ballers, direction: 'up', lineId: LINE_IDS.basketball });
    expect(backend.moves[0]?.key).toMatch(/\S/);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a second move of the same item the same way is a new move, not the same submission', async () => {
    const backend = galleryItemsBackend();
    const { result } = renderHook(() => useMoveGalleryItem(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.riders, direction: 'up', lineId: null });
    });
    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.riders, direction: 'up', lineId: null });
    });

    expect(backend.moves).toHaveLength(2);
    expect(backend.moves[0]?.key).not.toBe(backend.moves[1]?.key);
  });

  it('hides and shows with their own routes and clears the public data each time', async () => {
    const backend = galleryItemsBackend();
    const { result } = renderHook(() => useSetGalleryUploadShown(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.newUpload, shown: false });
    });
    await act(async () => {
      await result.current.submit({ id: GALLERY_IDS.newUpload, shown: true });
    });

    expect(backend.hides).toEqual([GALLERY_IDS.newUpload]);
    expect(backend.shows).toEqual([GALLERY_IDS.newUpload]);
    expect(invalidatePublicContent).toHaveBeenCalledTimes(2);
  });

  it('deletes with DELETE and clears the public data; a 404 clears nothing', async () => {
    const backend = galleryItemsBackend(undefined, {
      onDelete: (id) => (id === GALLERY_IDS.hoopers ? problemAnswer(404, { code: 'gallery-items.not-found' }) : undefined),
    });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useDeleteGalleryUpload({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit(GALLERY_IDS.newUpload);
    });
    expect(backend.deletes).toEqual([GALLERY_IDS.newUpload]);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.submit(GALLERY_IDS.hoopers);
    });
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 404 });
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });
});
