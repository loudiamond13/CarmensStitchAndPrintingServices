// The shop facts for public pages (PUB-02, D-42): the first visit reads the server's boot block, later reads go to the API.
import { createPublicResource, type PublicResourceState } from '@/lib/public-data/publicResource';
import { siteService, type PublicSite } from '../services/siteService';

/** Reads again after five minutes; the browser revalidates the answer with its ETag. */
export const SITE_STALE_MS = 5 * 60 * 1000;

export const siteResource = createPublicResource<PublicSite>({
  key: 'site',
  load: (signal) => siteService.getSite(signal),
  staleMs: SITE_STALE_MS,
});

export function useSiteQuery(): PublicResourceState<PublicSite> {
  return siteResource.useResource();
}
