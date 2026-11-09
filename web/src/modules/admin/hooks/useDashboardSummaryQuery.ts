// The dashboard summary (DASH-01, D-13). It is read again on every visit: the figures are live, so nothing is served from a
// fresh cache. Keep every dashboard query under the root key so one invalidation reaches them all.
import { useQuery } from '@tanstack/react-query';
import {
  dashboardService,
  parseDashboardSummary,
  type DashboardSummary,
} from '@/modules/admin/services/dashboardService';

/** What a summary card reads of the query, so a card never owns the request and a test can hand it plain values. */
export interface DashboardCardQuery {
  readonly data: DashboardSummary | undefined;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => unknown;
}

/** The root key of every dashboard query: invalidate it after any order, payment or expense change. */
export const dashboardKey = ['dashboard'] as const;
export const dashboardSummaryKey = ['dashboard', 'summary'] as const;

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: dashboardSummaryKey,
    // An answer the browser cannot read fails the query, so each card shows its alert instead of a broken figure.
    queryFn: async ({ signal }) => parseDashboardSummary(await dashboardService.summary(signal)),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
