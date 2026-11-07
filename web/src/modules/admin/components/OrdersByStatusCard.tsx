// RED stub (plan 10-09): the real card replaces this in the GREEN commit.
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';

export function OrdersByStatusCard({ query }: { query: DashboardCardQuery }) {
  return <section data-loaded={query.data === undefined ? 'no' : 'yes'} />;
}
