// Dev-only scenario wrappers (plan 12-29; never shipped, D-20): the Visitor Stats parts the visitor-stats scenarios name.
// StatBarList and PageSpeedCard live in the admin module, not in an `@/components` barrel, so the kit gets them from here.
// The page states (the 13-month Note, no visits, the failed read and the failed refresh) are drawn as VisitorStatsPage
// draws them, with the page's own copy, so the scenarios hold only demo data.
import { Button, EmptyState, ErrorState, hitAreaClasses, Note } from '@/components';
import {
  dashboardCardClasses,
  dashboardStaleClasses,
  dashboardStaleTextClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { formatCalendarDate } from '@/utils/format';
import { serverError } from './serverError';

export { PageSpeedCard } from '@/modules/admin/components/PageSpeedCard';
export { StatBarList } from '@/modules/admin/components/StatBarList';

const COPY = VISITOR_STATS_COPY;

/** The 13-month Note of a range that starts before the cut. */
export function StatsCutNote({ cutDate }: { cutDate: string }) {
  return <Note icon="info">{COPY.cutNote(formatCalendarDate(cutDate) ?? cutDate)}</Note>;
}

/** The one EmptyState that replaces the trend, lists and speed when the range has no page views. */
export function StatsNoVisits() {
  return (
    <div className={dashboardCardClasses}>
      <EmptyState icon="chart-column" level={2} title={COPY.noVisits.title} message={COPY.noVisits.message} />
    </div>
  );
}

/** A failed first read: the ErrorState with Try Again, for a 500 that carries a reference. */
export function StatsLoadError({ traceId, onRetry }: { traceId: string; onRetry?: () => void }) {
  return <ErrorState things={COPY.things} align="start" error={serverError(traceId)} onRetry={onRetry} />;
}

/** A failed later refresh (P10 D-111): the stale line with Try Again, as under the page subline. */
export function StatsStaleLine({ time, onRetry }: { time: string; onRetry: () => void }) {
  return (
    <div className={dashboardStaleClasses}>
      <p role="alert" className={dashboardStaleTextClasses}>
        {COPY.stale(time)}
      </p>
      <Button variant="ghost" size="sm" className={hitAreaClasses} onClick={onRetry}>
        {COPY.retry}
      </Button>
    </div>
  );
}
