// useGalleryQuery (GAL-01, D-42): the Gallery has no boot block, so every first visit reads GET /api/v1/public/gallery.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw';
import {
  answerGallery,
  demoGallery,
  demoSite,
  galleryFailureHandler,
  putBootBlock,
  resetPublicData,
} from '@/test/publicFixtures';
import { useGalleryQuery } from './useGalleryQuery';

afterEach(() => {
  resetPublicData();
});

describe('useGalleryQuery', () => {
  it('starts loading and then holds the gallery the API answered', async () => {
    answerGallery(demoGallery);

    const { result } = renderHook(() => useGalleryQuery());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoGallery });
    });
  });

  it('still reads the API when the boot block holds only the site', async () => {
    answerGallery(demoGallery);
    putBootBlock(demoSite);

    const { result } = renderHook(() => useGalleryQuery());

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoGallery });
    });
  });

  it('a failed read is an error with a retry that loads it again', async () => {
    server.use(galleryFailureHandler(500));
    const { result } = renderHook(() => useGalleryQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    answerGallery(demoGallery);
    if (result.current.status === 'error') {
      result.current.retry();
    }

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoGallery });
    });
  });
});
