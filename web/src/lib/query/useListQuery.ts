// RED placeholder (02-08 Task 1): wrong key and no signal; replaced in GREEN.
import { useQuery } from '@tanstack/react-query';
import { keys } from './keys';

export interface UseListQueryOptions<P extends object, T> {
  area: string;
  params: P;
  queryFn: (params: P, signal: AbortSignal) => Promise<T>;
}

export function useListQuery<P extends object, T>({ area, params, queryFn }: UseListQueryOptions<P, T>) {
  return useQuery({ queryKey: keys.list(area), queryFn: () => queryFn(params, undefined as unknown as AbortSignal) });
}
