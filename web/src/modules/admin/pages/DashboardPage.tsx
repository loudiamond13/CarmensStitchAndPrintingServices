// D1 Dashboard, /admin (DASH-01, DASH-02, DASH-06, D-13). The header: the greeting, the business date and the two actions, all
// built from the server's summary, never the device clock; under it the cards that the same summary feeds. While the summary
// loads or has failed the h1 reads "Dashboard", so the page always has a title; each card shows its own loading and failure.
// The Income vs. expenses card reads its own query (the chart), so a failed chart never blanks the cards that the summary feeds.
// The money strip under the header (D-46) reads the caller's own money on hand, so a failed summary never blanks it either.
import clsx from 'clsx';
import { useEffect } from 'react';
import { ButtonLink } from '@/components/actions';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { SkeletonText } from '@/components/states';
import { DashboardKpiRow } from '@/modules/admin/components/DashboardKpiRow';
import {
  dashboardHeadActionsClasses,
  dashboardRowClasses,
  dashboardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { IncomeExpenseCard } from '@/modules/admin/components/IncomeExpenseCard';
import { MoneyStrip } from '@/modules/admin/components/MoneyStrip';
import { OrdersByStatusCard } from '@/modules/admin/components/OrdersByStatusCard';
import { RecentOrdersCard } from '@/modules/admin/components/RecentOrdersCard';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import { useDashboardSummaryQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { formatCalendarDate, formatCalendarWeekday } from '@/utils/format';

const COPY = DASHBOARD_COPY;

export function DashboardRoute() {
  const summary = useDashboardSummaryQuery();
  const money = useMyMoneyQuery();

  useEffect(() => {
    document.title = `${COPY.title}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = summary.data;
  const title = data === undefined ? null : COPY.greeting(data.greeting, data.firstName);
  const weekday = data === undefined ? null : formatCalendarWeekday(data.today);
  const date = data === undefined ? null : formatCalendarDate(data.today);
  const subline = weekday !== null && date !== null ? COPY.subline(weekday, date) : null;

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={clsx(pageTitleClasses, dashboardTitleClasses)}>{title ?? COPY.title}</h1>
          {summary.isPending && <SkeletonText lines={1} />}
          {subline !== null && <p className={pageSublineClasses}>{subline}</p>}
        </div>
        <div className={dashboardHeadActionsClasses}>
          <ButtonLink variant="secondary" to="/admin/orders">
            {COPY.viewOrders}
          </ButtonLink>
          <ButtonLink variant="primary" icon="plus" to="/admin/orders/new">
            {COPY.newOrder}
          </ButtonLink>
        </div>
      </div>
      <MoneyStrip query={money} />
      <DashboardKpiRow query={summary} />
      <div className={dashboardRowClasses}>
        <IncomeExpenseCard />
        <OrdersByStatusCard query={summary} />
      </div>
      <RecentOrdersCard query={summary} />
    </>
  );
}
