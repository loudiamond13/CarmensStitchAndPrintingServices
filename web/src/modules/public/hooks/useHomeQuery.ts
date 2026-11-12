// The Home data for the public Home page (PUB-02, CONT-03, D-42): the first visit reads the server's boot block, later reads go to the API.
import { createPublicResource, type PublicResourceState } from '@/lib/public-data/publicResource';
import type { PublicHome } from '../services/contentService';

/** Reads again after five minutes; the browser revalidates the answer with its ETag. */
export const HOME_STALE_MS = 5 * 60 * 1000;

// The service (and the HTTP client under it) loads only when a read is needed, so a first visit that finds the boot block
// never downloads it (public bundle budget, PERF-01).
export const homeResource = createPublicResource<PublicHome>({
  key: 'home',
  load: async (signal) => (await import('../services/contentService')).contentService.getHome(signal),
  staleMs: HOME_STALE_MS,
});

export function useHomeQuery(): PublicResourceState<PublicHome> {
  return homeResource.useResource();
}
