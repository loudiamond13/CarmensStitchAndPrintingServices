// The Income vs. expenses card (DASH-03, DASH-06, D-36, D-50; UI-SPEC D3). The chart of plan 10-04 fed by the chart endpoint: the
// server's months oldest first, with the profit line. The browser only formats: income, expenses and profit are the server's figures,
// and the month names are built from the server's own `yyyy-MM` keys, never the device clock. No month is made up for a missing one.
// The range (6 or 12 months) lives in the URL. While the other range loads the last months stay, dimmed after 200 ms, and the sub line
// and the empty message keep naming the range on screen (D-107). The card reads its own query, so a failed chart shows only this card's alert.
import { IncomeExpenseChart, type ChartDatum } from '@/components/data';
import { EmptyState, Skeleton } from '@/components/feedback';
import { SegmentedControl } from '@/components/choice';
import { ErrorState, LoadingRegion, useDelayedFlag } from '@/components/states';
import {
  chartBodyClasses,
  chartEmptyClasses,
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardStateClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import { useDashboardChartQuery } from '@/modules/admin/hooks/useDashboardChartQuery';
import { useDashboardRange, type DashboardRange } from '@/modules/admin/hooks/useDashboardRange';
import type { DashboardChartMonthFigures, DashboardChartMonths } from '@/modules/admin/services/dashboardService';
import { formatMonthShort } from '@/utils/format';

const COPY = DASHBOARD_COPY.chart;

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The chart keeps the last months on screen and dims them only after this long (the P2 refetch rule). */
const REFETCH_MARK_DELAY_MS = 200;

/** The first load's skeleton height, the chart's own default view box height. */
const SKELETON_HEIGHT = 220;

/** One server month as a bar group: "Oct" under the bars, "Oct 2026" for assistive technology. A key that is not `yyyy-MM` has no group. */
function toDatum(item: DashboardChartMonthFigures): ChartDatum[] {
  const short = MONTH_KEY.test(item.month) ? formatMonthShort(`${item.month}-01`) : null;
  if (short === null) return [];
  return [
    {
      month: short,
      label: `${short} ${item.month.slice(0, 4)}`,
      income: item.income,
      expenses: item.expenses,
      profit: item.profit,
    },
  ];
}

/** The chart's bar groups from the server's months, oldest first. */
export function toChartData(items: readonly DashboardChartMonthFigures[]): ChartDatum[] {
  return items.flatMap(toDatum);
}

export interface IncomeExpenseCardViewProps {
  range: DashboardRange;
  /** The months of the answer on screen: the sub line and the empty message name them, not the range just picked. */
  months: DashboardChartMonths;
  onRangeChange: (range: DashboardRange) => void;
  /** The bar groups, or null while no answer is held. */
  data: ChartDatum[] | null;
  /** The status region says the chart is loading: the first load, or (with data held) a slow range change. */
  loading: boolean;
  failed: boolean;
  error: unknown;
  onRetry: () => void;
  /** The held months are dimmed while another range loads. */
  dimmed: boolean;
}

/** The card as the screen draws it, from plain values: the page reads the chart, and the Component Showcase hands it demo data. */
export function IncomeExpenseCardView({
  range,
  months,
  onRangeChange,
  data,
  loading,
  failed,
  error,
  onRetry,
  dimmed,
}: IncomeExpenseCardViewProps) {
  // One region stays mounted through loading, failure, Try Again and loaded, so its status node can say each step.
  let content;
  if (failed) {
    content = (
      <div className={dashboardCardStateClasses}>
        <ErrorState things={COPY.things} align="start" error={error} onRetry={onRetry} />
      </div>
    );
  } else if (data === null) {
    content = (
      <div className={dashboardCardStateClasses}>
        <Skeleton height={SKELETON_HEIGHT} />
      </div>
    );
  } else if (data.every((datum) => datum.income === 0 && datum.expenses === 0)) {
    content = (
      <div className={chartEmptyClasses} data-refetching={dimmed ? 'true' : undefined}>
        <EmptyState icon="trending-up" level={3} title={COPY.emptyTitle} message={COPY.emptyMessage(months)} />
      </div>
    );
  } else {
    content = (
      <div className={chartBodyClasses} data-refetching={dimmed ? 'true' : undefined}>
        <IncomeExpenseChart data={data} showProfit labels={COPY.labels} />
      </div>
    );
  }

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
          onChange={onRangeChange}
        />
      </div>
      <LoadingRegion loading={loading} failed={failed} things={COPY.things}>
        {content}
      </LoadingRegion>
    </section>
  );
}

export function IncomeExpenseCard() {
  const { range, months, setRange } = useDashboardRange();
  const query = useDashboardChartQuery(months);
  const refetching = query.isPlaceholderData && query.isFetching;
  const marked = useDelayedFlag(refetching, REFETCH_MARK_DELAY_MS);
  const data = query.data === undefined ? null : toChartData(query.data.items);

  return (
    <IncomeExpenseCardView
      range={range}
      months={query.data?.months ?? months}
      onRangeChange={setRange}
      data={data}
      loading={data === null ? query.isPending : marked}
      failed={query.isError}
      error={query.error}
      onRetry={() => {
        void query.refetch();
      }}
      dimmed={marked}
    />
  );
}
