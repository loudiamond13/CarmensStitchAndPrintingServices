// The Orders by status card (DASH-04, DASH-06, D-08, 07 D-01; UI-SPEC D1 "Orders by status card"). Six rows (the five active
// statuses and Completed this month) with the server's counts. The active total is the server's `orders.active`, never a sum
// made here. The only arithmetic is the bar: its width is the row's count over the largest of the six counts, a drawing ratio.
// If the summary fails the card shows its own alert; the old counts are not kept beside it.
import { EmptyState } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { StatusBadge } from '@/components/status';
import {
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardStateClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
  statusCountClasses,
  statusFillClasses,
  statusListClasses,
  statusRowClasses,
  statusTotalClasses,
  statusTotalFigureClasses,
  statusTrackClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import type { DashboardSummaryResponse } from '@/modules/admin/services/dashboardService';
import { formatCount } from '@/utils/format';

const COPY = DASHBOARD_COPY.statuses;

/** The rows in their order. Any other status the server sends is not drawn (D-08). */
const ROWS = ['pending', 'mockup', 'production', 'ready', 'delivered', 'completed'] as const;
type Row = (typeof ROWS)[number];

/** The generated types allow a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

function countOf(statuses: DashboardSummaryResponse['statuses'], row: Row): number {
  const entry = statuses.find((candidate) => candidate.status === row);
  return entry === undefined ? 0 : toNumber(entry.count);
}

/** The bar width in percent, to two decimals: 7 of 11 is "63.64%", the largest is "100%", a 0 is "0%" (the track only). */
function barWidth(count: number, largest: number): string {
  return largest === 0 ? '0%' : `${String(Math.round((count / largest) * 10_000) / 100)}%`;
}

export interface OrdersByStatusCardProps {
  query: DashboardCardQuery;
}

export function OrdersByStatusCard({ query }: OrdersByStatusCardProps) {
  const summary = query.data;
  const counts = summary === undefined ? null : ROWS.map((row) => countOf(summary.statuses, row));
  const largest = counts === null ? 0 : Math.max(...counts);

  let body;
  if (query.isError) {
    body = (
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
  } else if (summary === undefined || counts === null) {
    body = (
      <LoadingRegion loading things={COPY.things}>
        <div className={statusListClasses}>
          {ROWS.map((row) => (
            <SkeletonText key={row} lines={1} />
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (largest === 0) {
    body = <EmptyState icon="clipboard-list" level={3} title={COPY.emptyTitle} message={COPY.emptyMessage} />;
  } else {
    body = (
      <>
        <ul className={statusListClasses}>
          {ROWS.map((row, index) => (
            <li key={row} className={statusRowClasses}>
              <span>
                <StatusBadge status={row} />
                {row === 'completed' && <span className={srOnlyClasses}>{COPY.thisMonth}</span>}
              </span>
              <span className={statusTrackClasses} aria-hidden="true">
                <span className={statusFillClasses[row]} style={{ '--bar-w': barWidth(counts[index] ?? 0, largest) }} />
              </span>
              <strong className={statusCountClasses}>{formatCount(counts[index] ?? 0)}</strong>
            </li>
          ))}
        </ul>
        <div className={statusTotalClasses}>
          <span>{COPY.activeLabel}</span>
          <strong className={statusTotalFigureClasses}>{COPY.orders(toNumber(summary.orders.active))}</strong>
        </div>
      </>
    );
  }

  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.title}</h2>
          <p className={dashboardCardSubClasses}>{COPY.sub}</p>
        </div>
      </div>
      {body}
    </section>
  );
}
