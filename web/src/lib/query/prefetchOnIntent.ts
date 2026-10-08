// Intent prefetch (WEB-08): when the pointer enters or focus reaches a link, start the target screen's query so its
// data is cached by the time the user opens it. Returns plain event handlers and adds no markup (React Router's
// <Link prefetch> inserts <link rel="prefetch"> elements, a markup change, so it is not used).
import type { QueryClient } from '@tanstack/react-query';

export interface IntentHandlers {
  onPointerEnter: () => void;
  onFocus: () => void;
}

export type PrefetchOptions = Parameters<QueryClient['query']>[0];

export function prefetchOnIntent(queryClient: QueryClient, options: PrefetchOptions): IntentHandlers {
  // queryClient.query is TanStack 5.103's replacement for the deprecated prefetchQuery: it fetches only when the cached
  // data is stale. A failed prefetch is swallowed, exactly as prefetchQuery did; the error stays in the cache.
  const prefetch = (): void => {
    queryClient.query(options).catch(() => undefined);
  };
  return { onPointerEnter: prefetch, onFocus: prefetch };
}
