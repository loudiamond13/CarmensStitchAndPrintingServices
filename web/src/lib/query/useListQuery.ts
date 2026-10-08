// RED placeholder (02-39 Task 1): an inert list query that never calls the fetcher.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface UseListQueryOptions<R extends string, P extends object, T> {
  key: R;
  params: P;
  fetcher: (params: P, signal: AbortSignal) => Promise<T>;
}

export function useListQuery<const R extends string, P extends object, T>(
  _options: UseListQueryOptions<R, P, T>,
): UseQueryResult<T> {
  return useQuery<T>({ queryKey: ['inert'], queryFn: () => new Promise<T>(() => undefined), enabled: false });
}
