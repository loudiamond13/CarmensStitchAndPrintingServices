// V1 Visitor Stats, /admin/visitor-stats (UI-SPEC V1; ANL-08, D-23, D-24, D-27, D-33, WEB-10). SPEC-GAP: V1.
// SPEC-DEVIATION: D-23 (a Manager-only page with its own menu item after Site Content).
// The `.s-ph` head with the range the server resolved and the date range toolbar, then the KPI row, the Trend card, the list
// cards and Page speed. Every count and share is the server's.
//   - The range lives in the URL through useVisitorStatsParams and nowhere else. A preset is sent by name; a custom range is
//     sent only once both dates pass the checks, and until then the page keeps the range it last applied.
//   - A range change keeps the last figures on screen, dimmed under aria-busy, until the new ones arrive.
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 either way.
import { useEffect, useState } from 'react';
import { Button, EmptyState, ErrorState, hitAreaClasses, LoadingRegion, Note, SkeletonText } from '@/components';
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
import { DeviceBrowserCard } from '@/modules/admin/components/DeviceBrowserCard';
import { PageSpeedCard } from '@/modules/admin/components/PageSpeedCard';
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
import { useBusinessToday } from '@/modules/admin/hooks/useBusinessToday';
import { useVisitorStatsParams } from '@/modules/admin/hooks/useVisitorStatsParams';
import { useVisitorStatsQuery } from '@/modules/admin/hooks/useVisitorStatsQuery';
import type { RankedItem, VisitorStats, VisitorStatsQuery } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { DEFAULT_STATS_RANGE, statsQueryFor, type StatsRangeState } from '@/modules/admin/visitorStatsRange';
import { formatBusinessTime, formatCalendarDate } from '@/utils/format';

const COPY = VISITOR_STATS_COPY;

const DEFAULT_QUERY: VisitorStatsQuery = { range: DEFAULT_STATS_RANGE, from: null, to: null };

/** "Oct 17 to Nov 15, 2026": the first day drops its year when both days are in the same year. */
function rangeText(from: string, to: string): string | null {
  const first = formatCalendarDate(from);
  const last = formatCalendarDate(to);
  if (first === null || last === null) return null;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return COPY.dates(sameYear ? first.replace(/, \d{4}$/, '') : first, last);
}

/** D-27: the Note's cut date when the range starts before the 13-month cut; otherwise null. */
function cutNoteDate(stats: VisitorStats | undefined): string | null {
  if (stats === undefined || stats.from >= stats.cutDate) return null;
  return formatCalendarDate(stats.cutDate);
}

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
  stats,
  loading,
  error,
  failed,
  staleAt,
  onRetry,
}: VisitorStatsPageProps) {
  const dates = stats === undefined ? null : rangeText(stats.from, stats.to);
  const cutDate = cutNoteDate(stats);
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
        <VisitorStatsToolbar value={range} onChange={onRangeChange} />
      </div>
      {failed ? (
        <ErrorState things={COPY.things} align="start" error={error} onRetry={onRetry} />
      ) : (
        <LoadingRegion loading={loading} things={COPY.things} className={visitorStatsBodyClasses}>
          {cutDate !== null && <Note icon="info">{COPY.cutNote(cutDate)}</Note>}
          <VisitorKpiRow totals={stats?.totals} />
          {stats?.totals.pageViews === 0 ? (
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
                <StatListCard title={COPY.lists.referrers} sub={COPY.lists.referrersSub} items={stats?.referrers} />
              </div>
              <div className={visitorStatsListRowClasses}>
                <DeviceBrowserCard devices={stats?.devices} browsers={stats?.browsers} />
                <PageSpeedCard speed={stats?.speed} />
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
  const today = useBusinessToday(values.range === CUSTOM_RANGE);
  const wanted = statsQueryFor(values, today);
  // The range last applied: a custom range that does not pass yet keeps it. Adjusted during render, not in an effect.
  const [applied, setApplied] = useState<VisitorStatsQuery>(wanted ?? DEFAULT_QUERY);
  if (wanted !== null && !sameQuery(wanted, applied)) {
    setApplied(wanted);
  }
  // A custom range waits for today, so a shared link asks for its own dates, not the default first.
  const query = useVisitorStatsQuery(wanted ?? applied, !(values.range === CUSTOM_RANGE && today === null));

  useEffect(() => {
    document.title = `${COPY.title}${ADMIN_COPY.titleSuffix}`;
  }, []);

  return (
    <VisitorStatsPage
      range={values}
      onRangeChange={(next) => {
        set.setFilters(next);
      }}
      stats={query.data}
      loading={query.isPending || query.isPlaceholderData}
      error={query.error}
      failed={query.isError && query.data === undefined}
      staleAt={
        query.isError && query.data !== undefined && !query.isFetching
          ? formatBusinessTime(new Date(query.dataUpdatedAt).toISOString())
          : null
      }
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}
