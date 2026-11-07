// The dashboard chart (DASH-03, D-13). Like the summary it is read again on every visit, and it lives under the dashboard root key,
// so the order and expense refresh hooks reach it with one invalidation. While another range loads, the last months stay.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  dashboardService,
  parseDashboardChart,
  type DashboardChartMonths,
} from '@/modules/admin/services/dashboardService';

/** One range's chart; the root `['dashboard']` reaches every one of them. */
export function dashboardChartKey(months: DashboardChartMonths) {
  return ['dashboard', 'chart', months] as const;
}

export function useDashboardChartQuery(months: DashboardChartMonths) {
  return useQuery({
    queryKey: dashboardChartKey(months),
    // An answer the browser cannot draw fails the query, so the card shows its alert instead of a broken chart.
    queryFn: async ({ signal }) => parseDashboardChart(await dashboardService.chart(months, signal), months),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  });
}
