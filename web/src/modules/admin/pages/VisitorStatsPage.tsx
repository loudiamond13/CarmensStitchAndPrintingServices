// V1 Visitor Stats, /admin/visitor-stats (UI-SPEC V1; ANL-08, D-23, D-24, D-27, D-33). SPEC-GAP: V1.
// The Manager-only page: the `.s-ph` head with the range the server resolved, then the KPI row. Every count is the server's.
// The route's loader (requireManager) keeps an Admin out; the API answers 403 either way.
import { useEffect } from 'react';
import { ErrorState, LoadingRegion } from '@/components';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { VisitorKpiRow } from '@/modules/admin/components/VisitorKpiRow';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useVisitorStatsQuery } from '@/modules/admin/hooks/useVisitorStatsQuery';
import type { VisitorStats } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { formatCalendarDate } from '@/utils/format';

const COPY = VISITOR_STATS_COPY;

/** "Oct 17 to Nov 15, 2026": the first day drops its year when both days are in the same year. */
function rangeText(from: string, to: string): string | null {
  const first = formatCalendarDate(from);
  const last = formatCalendarDate(to);
  if (first === null || last === null) return null;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return COPY.dates(sameYear ? first.replace(/, \d{4}$/, '') : first, last);
}

export interface VisitorStatsPageProps {
  stats: VisitorStats | undefined;
  loading: boolean;
  error: unknown;
  failed: boolean;
  onRetry: () => void;
}

export function VisitorStatsPage({ stats, loading, error, failed, onRetry }: VisitorStatsPageProps) {
  const dates = stats === undefined ? null : rangeText(stats.from, stats.to);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{COPY.title}</h1>
          {dates !== null && <p className={pageSublineClasses}>{COPY.subline(dates)}</p>}
        </div>
      </div>
      {failed ? (
        <ErrorState things={COPY.things} align="start" error={error} onRetry={onRetry} />
      ) : (
        <LoadingRegion loading={loading} things={COPY.things}>
          <VisitorKpiRow totals={stats?.totals} />
        </LoadingRegion>
      )}
    </>
  );
}

export function VisitorStatsRoute() {
  const query = useVisitorStatsQuery({ range: 'last-30-days', from: null, to: null });

  useEffect(() => {
    document.title = `${COPY.title}${ADMIN_COPY.titleSuffix}`;
  }, []);

  return (
    <VisitorStatsPage
      stats={query.data}
      loading={query.isPending}
      error={query.error}
      failed={query.isError && query.data === undefined}
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}
