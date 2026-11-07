// The Income vs. expenses card (DASH-03, DASH-06, D-36, D-50; UI-SPEC D3). The chart of plan 10-04 fed by the chart endpoint: the
// server's months oldest first, with the profit line. The browser only formats: income, expenses and profit are the server's figures,
// and the month names are built from the server's own `yyyy-MM` keys, never the device clock. No month is made up for a missing one.
// The range (6 or 12 months) lives in the URL. While the other range loads the last months stay, dimmed after 200 ms. The card reads
// its own query, so a failed chart shows only this card's alert.
import { IncomeExpenseChart, type ChartDatum } from '@/components/data';
import { EmptyState, Skeleton } from '@/components/feedback';
import { SegmentedControl } from '@/components/choice';
import { ErrorState, LoadingRegion, useDelayedFlag } from '@/components/states';
import {
  chartBodyClasses,
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardStateClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import { useDashboardChartQuery } from '@/modules/admin/hooks/useDashboardChartQuery';
import { useDashboardRange, type DashboardRange } from '@/modules/admin/hooks/useDashboardRange';
import type { DashboardChartResponse } from '@/modules/admin/services/dashboardService';
import { formatMonthShort } from '@/utils/format';

const COPY = DASHBOARD_COPY.chart;

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The chart keeps the last months on screen and dims them only after this long (the P2 refetch rule). */
const REFETCH_MARK_DELAY_MS = 200;

/** The first load's skeleton height, the chart's own default view box height. */
const SKELETON_HEIGHT = 220;

/** The generated types allow a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

/** One server month as a bar group: "Oct" under the bars, "Oct 2026" for assistive technology. A key that is not `yyyy-MM` has no group. */
function toDatum(item: DashboardChartResponse['items'][number]): ChartDatum[] {
  const short = MONTH_KEY.test(item.month) ? formatMonthShort(`${item.month}-01`) : null;
  if (short === null) return [];
  return [
    {
      month: short,
      label: `${short} ${item.month.slice(0, 4)}`,
      income: toNumber(item.income),
      expenses: toNumber(item.expenses),
      profit: toNumber(item.profit),
    },
  ];
}

export function IncomeExpenseCard() {
  const { range, months, setRange } = useDashboardRange();
  const query = useDashboardChartQuery(months);
  const refetching = query.isPlaceholderData && query.isFetching;
  const marked = useDelayedFlag(refetching, REFETCH_MARK_DELAY_MS);
  const data = query.data === undefined ? null : query.data.items.flatMap(toDatum);

  // One region stays mounted through loading, failure, Try Again and loaded, so its status node can say each step.
  let content;
  if (query.isError) {
    content = (
      <div className={dashboardCardStateClasses}>
        <ErrorState
          things={COPY.things}
          align="start"
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  } else if (data === null) {
    content = (
      <div className={dashboardCardStateClasses}>
        <Skeleton height={SKELETON_HEIGHT} />
      </div>
    );
  } else if (data.every((datum) => datum.income === 0 && datum.expenses === 0)) {
    content = <EmptyState icon="trending-up" level={3} title={COPY.emptyTitle} message={COPY.emptyMessage(months)} />;
  } else {
    content = (
      <div className={chartBodyClasses} data-refetching={marked ? 'true' : undefined}>
        <IncomeExpenseChart data={data} showProfit labels={COPY.labels} />
      </div>
    );
  }
  const body = (
    <LoadingRegion loading={data === null ? query.isPending : marked} failed={query.isError} things={COPY.things}>
      {content}
    </LoadingRegion>
  );

  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.title}</h2>
          <p className={dashboardCardSubClasses}>{COPY.sub(months)}</p>
        </div>
        <SegmentedControl<DashboardRange>
          label={COPY.rangeLabel}
          options={COPY.ranges}
          value={range}
          onChange={setRange}
        />
      </div>
      {body}
    </section>
  );
}
