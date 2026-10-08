// One set of TanStack Query defaults (WEB-08, research Pattern 9). A later screen may override a single query (for
// example staleTime 0 on a financial detail) without changing these shared defaults (backlog 999.3).
import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

export const QUERY_DEFAULTS = {
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    // The HTTP client owns retries (capped); a Query retry on top would multiply requests (Pitfall 16, T-02-81).
    retry: false,
    refetchOnWindowFocus: true,
  },
  mutations: {
    retry: false,
  },
} as const satisfies DefaultOptions;

/** A new client with its own cache. The app makes one; every test makes its own. */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: QUERY_DEFAULTS });
}
