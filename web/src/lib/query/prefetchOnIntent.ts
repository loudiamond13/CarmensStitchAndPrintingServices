// RED placeholder (02-08 Task 3): the handlers only read the cache and never prefetch; replaced in GREEN.
import type { QueryClient } from '@tanstack/react-query';

export interface IntentHandlers {
  onPointerEnter: () => void;
  onFocus: () => void;
}

export type PrefetchOptions = Parameters<QueryClient['query']>[0];

export function prefetchOnIntent(queryClient: QueryClient, options: PrefetchOptions): IntentHandlers {
  const read = (): void => {
    queryClient.getQueryData(options.queryKey);
  };
  return { onPointerEnter: read, onFocus: read };
}
