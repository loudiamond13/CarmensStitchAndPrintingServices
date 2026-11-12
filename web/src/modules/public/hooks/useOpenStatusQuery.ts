// The open status for the Contact page (PUB-05, D-22): the server says whether the shop is open now. The page reads it
// again every five minutes while it is visible, and once when the tab comes back; the browser never works it out itself.
import { useEffect } from 'react';
import { createPublicResource, type PublicResourceState } from '@/lib/public-data/publicResource';
import type { OpenStatus } from '../services/siteService';

/** How often a visible page asks again. The server answers are cached for 60 seconds. */
export const OPEN_STATUS_REFRESH_MS = 5 * 60 * 1000;

export const openStatusResource = createPublicResource<OpenStatus>({
  load: async (signal) => (await import('../services/siteService')).siteService.getOpenStatus(signal),
  staleMs: OPEN_STATUS_REFRESH_MS,
});

export function useOpenStatusQuery(): PublicResourceState<OpenStatus> {
  const state = openStatusResource.useResource();
  const retry = state.status === 'error' ? state.retry : undefined;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (retry === undefined) {
        openStatusResource.invalidate();
      } else {
        retry();
      }
    };
    const timer = setInterval(refresh, OPEN_STATUS_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [retry]);
  return state;
}
