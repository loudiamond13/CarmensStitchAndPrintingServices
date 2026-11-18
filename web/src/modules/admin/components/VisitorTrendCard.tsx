// The Trend card of Visitor Stats (UI-SPEC V1 item 4; ANL-08). SPEC-GAP: V1. "Visits over time", per day or per month as the
// server chose, around VisitorTrendChart. Every figure is the server's. Until the first answer the chart frame keeps its
// 220 height with a skeleton.
import { Skeleton } from '@/components';
import { VisitorTrendChart } from '@/components/data';
import {
  chartBodyClasses,
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardStateClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import type { VisitorStats } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';

const COPY = VISITOR_STATS_COPY.trend;

/** The chart's own view box height, kept by the skeleton. */
const CHART_HEIGHT = 220;

export interface VisitorTrendCardProps {
  /** Undefined while the first read runs. */
  stats: VisitorStats | undefined;
}

export function VisitorTrendCard({ stats }: VisitorTrendCardProps) {
  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.title}</h2>
          {stats !== undefined && (
            <p className={dashboardCardSubClasses}>{stats.bucket === 'day' ? COPY.perDay : COPY.perMonth}</p>
          )}
        </div>
      </div>
      {stats === undefined ? (
        <div className={dashboardCardStateClasses}>
          <Skeleton height={CHART_HEIGHT} />
        </div>
      ) : (
        <div className={chartBodyClasses} data-trend-body="">
          <VisitorTrendChart buckets={stats.trend} bucket={stats.bucket} from={stats.from} to={stats.to} />
        </div>
      )}
    </section>
  );
}
