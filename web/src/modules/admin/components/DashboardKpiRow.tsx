// The four KPI cards under the dashboard header (DASH-02, DASH-06, D-01 to D-07, D-37; UI-SPEC D1 "KPI row"). Every figure, count
// and percent is the summary's; the browser only formats them (Core Value). The month names are the short months of the
// summary's own dates, never the device clock. While the summary loads each card is a skeleton; if the first read fails the row
// becomes one alert with Try Again. A later failed refresh keeps the last good figures, and the page marks them (D-111).
import { KpiCard } from '@/components/money';
import { ErrorState, LoadingRegion } from '@/components/states';
import { dashboardKpiRowClasses } from '@/modules/admin/components/dashboard.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { formatMonthShort } from '@/utils/format';

const COPY = DASHBOARD_COPY.kpis;

export interface DashboardKpiRowProps {
  query: DashboardCardQuery;
}

export function DashboardKpiRow({ query }: DashboardKpiRowProps) {
  if (query.isError && query.data === undefined) {
    return (
      <ErrorState
        things={COPY.things}
        align="start"
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const summary = query.data;
  const loading = summary === undefined;
  const thisMonth = loading ? null : formatMonthShort(summary.today);
  const comparisonMonth = loading ? null : formatMonthShort(summary.collected.comparisonThrough);
  const changePercent = loading ? null : summary.collected.changePercent;
  const topCategory = loading ? null : summary.expenses.topCategory;
  const expenseCount = loading ? 0 : summary.expenses.count;

  // The Collected foot: the percent against the same day last month, or (D-06) plain words when there is no percent.
  const collectedFoot =
    comparisonMonth === null
      ? {}
      : changePercent === null
        ? { hint: COPY.nothingCollected(comparisonMonth) }
        : { deltaLabel: COPY.againstSameDay(comparisonMonth) };

  return (
    <LoadingRegion loading={loading} things={COPY.things} className={dashboardKpiRowClasses}>
      <KpiCard
        label={COPY.active}
        value={loading ? 0 : summary.orders.active}
        money={false}
        icon="clipboard-list"
        hint={loading ? undefined : COPY.activeFoot(summary.orders.dueThisWeek, summary.orders.overdue)}
        loading={loading}
      />
      <KpiCard
        label={COPY.receivables}
        value={loading ? 0 : summary.orders.receivables}
        icon="wallet"
        hint={loading ? undefined : COPY.receivablesFoot}
        loading={loading}
      />
      <KpiCard
        label={COPY.collected(thisMonth)}
        value={loading ? 0 : summary.collected.thisMonth}
        icon="trending-up"
        delta={changePercent ?? undefined}
        {...(loading ? {} : collectedFoot)}
        loading={loading}
      />
      <KpiCard
        label={COPY.expenses(thisMonth)}
        value={loading ? 0 : summary.expenses.thisMonth}
        icon="receipt"
        hint={loading ? undefined : expenseCount === 0 ? COPY.noExpenses : COPY.expensesFoot(expenseCount, topCategory)}
        loading={loading}
      />
    </LoadingRegion>
  );
}
