// The Income vs. expenses card (DASH-03, D-36, D-50; UI-SPEC D3). The chart of plan 10-04 fed by the chart endpoint: the server's
// months oldest first, with the profit line. The browser only formats: income, expenses and profit are the server's figures, and
// the month names are built from the server's own `yyyy-MM` keys, never the device clock. No month is made up for a missing one.
import { IncomeExpenseChart, type ChartDatum } from '@/components/data';
import {
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardStateClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import { useDashboardChartQuery } from '@/modules/admin/hooks/useDashboardChartQuery';
import type { DashboardChartResponse } from '@/modules/admin/services/dashboardService';
import { formatMonthShort } from '@/utils/format';

const COPY = DASHBOARD_COPY.chart;

const MONTHS = 6;
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The generated types allow a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

/** One server month as a bar group: "Oct" under the bars, "Oct 2026" for assistive technology. A key that is not `yyyy-MM` has no group. */
function toDatum(item: DashboardChartResponse['items'][number]): ChartDatum[] {
  const match = MONTH_KEY.exec(item.month);
  const short = match === null ? null : formatMonthShort(`${item.month}-01`);
  if (match === null || short === null) return [];
  return [
    {
      month: short,
      label: `${short} ${match[1] ?? ''}`,
      income: toNumber(item.income),
      expenses: toNumber(item.expenses),
      profit: toNumber(item.profit),
    },
  ];
}

export function IncomeExpenseCard() {
  const query = useDashboardChartQuery(MONTHS);
  const data = query.data;

  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.title}</h2>
          <p className={dashboardCardSubClasses}>{COPY.sub(MONTHS)}</p>
        </div>
      </div>
      {data !== undefined && (
        <div className={dashboardCardStateClasses}>
          <IncomeExpenseChart data={data.items.flatMap(toDatum)} showProfit labels={COPY.labels} />
        </div>
      )}
    </section>
  );
}
