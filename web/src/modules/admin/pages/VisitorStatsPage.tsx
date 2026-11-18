// V1 Visitor Stats, /admin/visitor-stats (UI-SPEC V1; ANL-08, D-23, D-24, D-27, D-33, WEB-10). SPEC-GAP: V1.
// SPEC-DEVIATION: D-23 (a Manager-only page with its own menu item after Site Content).
// The `.s-ph` head with the range the server resolved and the date range toolbar, then the KPI row and the Trend card. Every count
// is the server's.
//   - The range lives in the URL through useVisitorStatsParams and nowhere else. A preset is sent by name; a custom range is
//     sent only once both dates pass the checks, and until then the page keeps the range it last applied.
//   - A range change keeps the last figures on screen, dimmed under aria-busy, until the new ones arrive.
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 either way.
import { useEffect, useState } from 'react';
import { ErrorState, LoadingRegion } from '@/components';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { CUSTOM_RANGE } from '@/lib/url-state/parsers';
import { visitorStatsBodyClasses } from '@/modules/admin/components/visitorStats.recipe';
import { VisitorKpiRow } from '@/modules/admin/components/VisitorKpiRow';
import { VisitorStatsToolbar } from '@/modules/admin/components/VisitorStatsToolbar';
import { VisitorTrendCard } from '@/modules/admin/components/VisitorTrendCard';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useBusinessToday } from '@/modules/admin/hooks/useBusinessToday';
import { useVisitorStatsParams } from '@/modules/admin/hooks/useVisitorStatsParams';
import { useVisitorStatsQuery } from '@/modules/admin/hooks/useVisitorStatsQuery';
import type { VisitorStats, VisitorStatsQuery } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { DEFAULT_STATS_RANGE, statsQueryFor, type StatsRangeState } from '@/modules/admin/visitorStatsRange';
import { formatCalendarDate } from '@/utils/format';

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
  onRetry: () => void;
}

export function VisitorStatsPage({
  range,
  onRangeChange,
  stats,
  loading,
  error,
  failed,
  onRetry,
}: VisitorStatsPageProps) {
  const dates = stats === undefined ? null : rangeText(stats.from, stats.to);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{COPY.title}</h1>
          {dates !== null && <p className={pageSublineClasses}>{COPY.subline(dates)}</p>}
        </div>
        <VisitorStatsToolbar value={range} onChange={onRangeChange} />
      </div>
      {failed ? (
        <ErrorState things={COPY.things} align="start" error={error} onRetry={onRetry} />
      ) : (
        <LoadingRegion loading={loading} things={COPY.things} className={visitorStatsBodyClasses}>
          <VisitorKpiRow totals={stats?.totals} />
          <VisitorTrendCard stats={stats} />
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
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}
