// The shop facts for public pages (PUB-02, D-42): the first visit reads the server's boot block, later reads go to the API.
import { createPublicResource, type PublicResourceState } from '@/lib/public-data/publicResource';
import type { PublicSite } from '../services/siteService';

/** Reads again after five minutes; the browser revalidates the answer with its ETag. */
export const SITE_STALE_MS = 5 * 60 * 1000;

// The service (and the HTTP client under it) loads only when a read is needed, so a first visit that finds the boot block
// never downloads it (public bundle budget, PERF-01).
export const siteResource = createPublicResource<PublicSite>({
  key: 'site',
  load: async (signal) => (await import('../services/siteService')).siteService.getSite(signal),
  staleMs: SITE_STALE_MS,
});

export function useSiteQuery(): PublicResourceState<PublicSite> {
  return siteResource.useResource();
}
