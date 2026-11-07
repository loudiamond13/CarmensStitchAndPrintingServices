// The dashboard summary (DASH-01, D-13). It is read again on every visit: the figures are live, so nothing is served from a
// fresh cache. Keep every dashboard query under the root key so one invalidation reaches them all.
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/modules/admin/services/dashboardService';

/** The root key of every dashboard query: invalidate it after any order, payment or expense change. */
export const dashboardKey = ['dashboard'] as const;
export const dashboardSummaryKey = ['dashboard', 'summary'] as const;

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: dashboardSummaryKey,
    queryFn: ({ signal }) => dashboardService.summary(signal),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
