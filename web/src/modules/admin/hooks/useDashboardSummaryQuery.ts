import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/modules/admin/services/dashboardService';

export const dashboardKey = ['dashboard'] as const;
export const dashboardSummaryKey = ['dashboard', 'summary'] as const;

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: dashboardSummaryKey,
    queryFn: ({ signal }) => dashboardService.summary(signal),
  });
}
