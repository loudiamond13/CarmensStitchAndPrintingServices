// The photo rules the server enforces (IMG-02, OR-3). They change only with a host setting, so one read serves a long visit.
import { queryOptions, useQuery } from '@tanstack/react-query';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';

const ONE_HOUR_MS = 60 * 60_000;

export const imageRulesKey = ['image-rules'] as const;

export const imageRulesQuery = queryOptions({
  queryKey: imageRulesKey,
  queryFn: ({ signal }) => orderPhotosService.rules(signal),
  staleTime: ONE_HOUR_MS,
});

export function useImageRulesQuery() {
  return useQuery(imageRulesQuery);
}
