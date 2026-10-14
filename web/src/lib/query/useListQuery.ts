// A list query (WEB-08): keyed on the parsed, defaulted list params, cancellable through its AbortSignal, and keeping
// the previous page's rows on screen (with isPlaceholderData true) while the next page loads.
import { keepPreviousData as keepPreviousPage, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listKey } from './keys';

export interface UseListQueryOptions<R extends string, P extends object, T> {
  /** The resource, the first key segment (for example 'orders'). */
  key: R;
  /** Parsed, defaulted values from the list's URL-state hook, with the search already debounced (useDebouncedValue). */
  params: P;
  /**
   * Calls the matching api.ts function and passes the signal on. The query aborts it when the screen unmounts or the
   * params change while the request is in flight, so a superseded request never keeps running.
   */
  fetcher: (params: P, signal: AbortSignal) => Promise<T>;
}

export function useListQuery<const R extends string, P extends object, T>({
  key,
  params,
  fetcher,
}: UseListQueryOptions<R, P, T>): UseQueryResult<T> {
  return useQuery({
    queryKey: listKey(key, params),
    queryFn: ({ signal }) => fetcher(params, signal),
    placeholderData: keepPreviousPage,
  });
}
