// One set of TanStack Query defaults (WEB-08, research Pattern 9). Later phases may override a single query (for
// example staleTime 0 on a financial detail screen) without changing these shared defaults.
import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

export const QUERY_DEFAULTS = {
  queries: {
    staleTime: 30_000,
    gcTime: 300_000,
    // The HTTP client owns retries (capped at 2); a Query retry on top would multiply requests (Pitfall 16).
    retry: false,
    refetchOnWindowFocus: true,
  },
  mutations: {
    retry: false,
  },
} as const satisfies DefaultOptions;

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: QUERY_DEFAULTS });
}
