// V1 Visitor Stats, /admin/visitor-stats (UI-SPEC V1; ANL-08, D-23, D-24, D-57, D-70, WEB-10). SPEC-GAP: V1.
// SPEC-DEVIATION: D-23 (a Manager-only page with its own menu item after Site Content).
// The `.s-ph` head with the range the server resolved and the date range toolbar, then the Page views card, the Trend card
// and the Most viewed pages list. Every count and share is the server's.
//   - The range lives in the URL through useVisitorStatsParams and nowhere else. A preset is sent by name; a custom range is
//     sent only once both dates pass the checks, and until then the page keeps the range it last applied.
//   - A range change keeps the last figures on screen, dimmed under aria-busy, until the new ones arrive.
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 either way.
import { useEffect, useState } from 'react';
import { Button, EmptyState, ErrorState, hitAreaClasses, LoadingRegion, SkeletonText } from '@/components';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { CUSTOM_RANGE } from '@/lib/url-state/parsers';
import {
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
  dashboardStaleClasses,
  dashboardStaleTextClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { StatBarList } from '@/modules/admin/components/StatBarList';
import {
  statListBodyClasses,
  visitorStatsBodyClasses,
  visitorStatsListRowClasses,
} from '@/modules/admin/components/visitorStats.recipe';
import { VisitorKpiRow } from '@/modules/admin/components/VisitorKpiRow';
import { VisitorStatsToolbar } from '@/modules/admin/components/VisitorStatsToolbar';
import { VisitorTrendCard } from '@/modules/admin/components/VisitorTrendCard';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useVisitorStatsToday } from '@/modules/admin/hooks/useVisitorStatsToday';
import { useVisitorStatsParams } from '@/modules/admin/hooks/useVisitorStatsParams';
import { useVisitorStatsQuery } from '@/modules/admin/hooks/useVisitorStatsQuery';
import type { RankedItem, VisitorStats, VisitorStatsQuery } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { DEFAULT_STATS_RANGE, statsQueryFor, type StatsRangeState } from '@/modules/admin/visitorStatsRange';
import { formatBusinessTime, formatRangeText } from '@/utils/format';

const COPY = VISITOR_STATS_COPY;

const DEFAULT_QUERY: VisitorStatsQuery = { range: DEFAULT_STATS_RANGE, from: null, to: null };

function pageLabel(key: string): string {
  return COPY.pages[key] ?? key;
}

interface StatListCardProps {
  title: string;
  sub: string;
  /** Undefined while the first read runs. */
  items: readonly RankedItem[] | undefined;
  labelFor?: (name: string) => string;
}

/** A V1 list card: the title, its sub line and a StatBarList, or a skeleton until the first answer. */
function StatListCard({ title, sub, items, labelFor }: StatListCardProps) {
  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{title}</h2>
          <p className={dashboardCardSubClasses}>{sub}</p>
        </div>
      </div>
      <div className={statListBodyClasses}>
        {items === undefined ? (
          <SkeletonText lines={3} />
        ) : (
          <StatBarList items={items} labelFor={labelFor} emptyText={COPY.lists.empty} />
        )}
      </div>
    </section>
  );
}

function sameQuery(a: VisitorStatsQuery, b: VisitorStatsQuery): boolean {
  return a.range === b.range && a.from === b.from && a.to === b.to;
}

export interface VisitorStatsPageProps {
  range: StatsRangeState;
  onRangeChange: (next: StatsRangeState) => void;
  /** The range the figures are read for; Export CSV saves the same one. */
  exportQuery: VisitorStatsQuery;
  stats: VisitorStats | undefined;
  /** The first read, or a new range, is loading. */
  loading: boolean;
  error: unknown;
  /** The first read failed, so there is nothing to show. */
  failed: boolean;
  /** The time of the figures shown when a later refresh failed (P10 D-111); otherwise null. */
  staleAt: string | null;
  onRetry: () => void;
}

export function VisitorStatsPage({
  range,
  onRangeChange,
  exportQuery,
  stats,
  loading,
  error,
  failed,
  staleAt,
  onRetry,
}: VisitorStatsPageProps) {
  const dates = stats === undefined ? null : formatRangeText(stats.from, stats.to);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{COPY.title}</h1>
          {dates !== null && <p className={pageSublineClasses}>{COPY.subline(dates)}</p>}
          {staleAt !== null && (
            <div className={dashboardStaleClasses}>
              <p role="alert" className={dashboardStaleTextClasses}>
                {COPY.stale(staleAt)}
              </p>
              <Button variant="ghost" size="sm" className={hitAreaClasses} onClick={onRetry}>
                {COPY.retry}
              </Button>
            </div>
          )}
        </div>
        <VisitorStatsToolbar value={range} onChange={onRangeChange} exportQuery={exportQuery} />
      </div>
      {failed ? (
        <ErrorState things={COPY.things} align="start" error={error} onRetry={onRetry} />
      ) : (
        <LoadingRegion loading={loading} things={COPY.things} className={visitorStatsBodyClasses}>
          <VisitorKpiRow pageViews={stats?.pageViews} />
          {stats?.pageViews === 0 ? (
            <div className={dashboardCardClasses}>
              <EmptyState icon="chart-column" level={2} title={COPY.noVisits.title} message={COPY.noVisits.message} />
            </div>
          ) : (
            <>
              <VisitorTrendCard stats={stats} />
              <div className={visitorStatsListRowClasses}>
                <StatListCard
                  title={COPY.lists.topPages}
                  sub={COPY.lists.topPagesSub}
                  items={stats?.topPages}
                  labelFor={pageLabel}
                />
              </div>
            </>
          )}
        </LoadingRegion>
      )}
    </>
  );
}

export function VisitorStatsRoute() {
  const [values, set] = useVisitorStatsParams();
  // The business today bounds a custom range; it is asked for only when the range is custom.
  const custom = values.range === CUSTOM_RANGE;
  const { today, isError: todayFailed, error: todayError, refetch: refetchToday } = useVisitorStatsToday(custom);
  const wanted = statsQueryFor(values, today);
  // The range last applied: a custom range that does not pass yet keeps it. Adjusted during render, not in an effect.
  const [applied, setApplied] = useState<VisitorStatsQuery>(wanted ?? DEFAULT_QUERY);
  if (wanted !== null && !sameQuery(wanted, applied)) {
    setApplied(wanted);
  }
  // A custom range waits for today, so a shared link asks for its own dates, not the default first.
  const read = wanted ?? applied;
  const query = useVisitorStatsQuery(read, !(custom && today === null));
  // Without the date a custom range cannot be asked for: that is a failure to show, not a page that loads for ever.
  const noToday = custom && todayFailed;

  useEffect(() => {
    document.title = `${COPY.title}${ADMIN_COPY.titleSuffix}`;
  }, []);

  return (
    <VisitorStatsPage
      range={values}
      onRangeChange={(next) => {
        set.setFilters(next);
      }}
      exportQuery={read}
      stats={query.data}
      loading={!noToday && (query.isPending || query.isPlaceholderData)}
      error={noToday ? todayError : query.error}
      failed={noToday || (query.isError && query.data === undefined)}
      staleAt={
        query.isError && query.data !== undefined && !query.isFetching
          ? formatBusinessTime(new Date(query.dataUpdatedAt).toISOString())
          : null
      }
      onRetry={() => {
        if (noToday) refetchToday();
        else void query.refetch();
      }}
    />
  );
}
