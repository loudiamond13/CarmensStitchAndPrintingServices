// A list query (WEB-08): keyed on the parsed, defaulted list params, cancellable through its AbortSignal, and keeping
// the previous page's rows on screen while the next page loads.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { keys } from './keys';

export interface UseListQueryOptions<A extends string, P extends object, T> {
  /** The resource area, the first key segment (for example 'orders'). */
  area: A;
  /** Parsed, defaulted values from the list's URL-state hook, with the search already debounced. */
  params: P;
  /** Calls the matching api.ts function and passes the signal on, so a superseded request is cancelled. */
  queryFn: (params: P, signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
}

export function useListQuery<const A extends string, P extends object, T>({
  area,
  params,
  queryFn,
  enabled = true,
}: UseListQueryOptions<A, P, T>) {
  return useQuery({
    queryKey: keys.list(area, params),
    queryFn: ({ signal }) => queryFn(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
