// The Gallery data (GAL-01, D-42): every shown item, the pills and the total in one read. The server writes no boot block for
// the Gallery, so the first visit reads GET /api/v1/public/gallery; later reads revalidate with the answer's ETag.
import { createPublicResource, type PublicResourceState } from '@/lib/public-data/publicResource';
import type { PublicGallery } from '../services/contentService';

/** Reads again after five minutes. */
export const GALLERY_STALE_MS = 5 * 60 * 1000;

// The service loads only when a read is needed (public bundle budget, PERF-01).
export const galleryResource = createPublicResource<PublicGallery>({
  load: async (signal) => (await import('../services/contentService')).contentService.getGallery(signal),
  staleMs: GALLERY_STALE_MS,
});

export function useGalleryQuery(): PublicResourceState<PublicGallery> {
  return galleryResource.useResource();
}
