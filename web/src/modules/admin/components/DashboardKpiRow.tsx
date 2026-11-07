// RED stub (plan 10-09): the real row replaces this in the GREEN commit.
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';

export function DashboardKpiRow({ query }: { query: DashboardCardQuery }) {
  return <div data-loaded={query.data === undefined ? 'no' : 'yes'} />;
}
