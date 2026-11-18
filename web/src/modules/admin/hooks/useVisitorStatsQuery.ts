// The visitor stats read (ANL-08). Keyed on the parsed range from the URL; a range change keeps the last figures on screen
// (isPlaceholderData true) until the new ones arrive, and a superseded request is cancelled.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { visitorStatsService, type VisitorStatsQuery } from '@/modules/admin/services/visitorStatsService';

/** The root of every visitor stats query. */
export const visitorStatsKey = ['visitor-stats'] as const;

/** `enabled` false holds the request back until a value it needs is known (default true). */
export function useVisitorStatsQuery(query: VisitorStatsQuery, enabled = true) {
  return useQuery({
    queryKey: [...visitorStatsKey, query.range, query.from, query.to] as const,
    queryFn: ({ signal }) => visitorStatsService.get(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
