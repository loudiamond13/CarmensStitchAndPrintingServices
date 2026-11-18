// The three KPI cards of Visitor Stats (UI-SPEC V1 item 3; ANL-08, D-27, D-33). SPEC-GAP: V1. Every count is the server's; the
// card only groups it en-PH. A count the server does not have for dates over 13 months ago shows EmptyValue read as "Not
// available"; a range that crosses that line says from which day the count starts.
import { KpiCard, type IconName } from '@/components';
import { visitorKpiRowClasses } from '@/modules/admin/components/visitorStats.recipe';
import type { VisitorTotals } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { formatCalendarDate } from '@/utils/format';

const COPY = VISITOR_STATS_COPY.kpis;

export interface VisitorKpiRowProps {
  /** Undefined while the first read runs. */
  totals: VisitorTotals | undefined;
}

interface RawCountCardProps {
  label: string;
  icon: IconName;
  hint: string;
  value: number | null | undefined;
  countedFrom: string | null | undefined;
}

/** Unique visitors and Visits: counted from the raw visits, which are kept for 13 months. */
function RawCountCard({ label, icon, hint, value, countedFrom }: RawCountCardProps) {
  if (value === undefined) {
    return <KpiCard label={label} value={0} money={false} icon={icon} loading />;
  }
  if (value === null) {
    return (
      <KpiCard
        label={label}
        value={0}
        money={false}
        icon={icon}
        empty
        emptyLabel={COPY.notAvailable}
        hint={COPY.notAvailableHint}
      />
    );
  }
  const partial =
    countedFrom === null || countedFrom === undefined
      ? null
      : COPY.countedFrom(formatCalendarDate(countedFrom) ?? countedFrom);
  return <KpiCard label={label} value={value} money={false} icon={icon} hint={partial ?? hint} />;
}

export function VisitorKpiRow({ totals }: VisitorKpiRowProps) {
  return (
    <div className={visitorKpiRowClasses}>
      <RawCountCard
        label={COPY.uniqueVisitors}
        icon="users"
        hint={COPY.uniqueVisitorsHint}
        value={totals?.uniqueVisitors}
        countedFrom={totals?.countedFrom}
      />
      <RawCountCard
        label={COPY.visits}
        icon="clock"
        hint={COPY.visitsHint}
        value={totals?.visits}
        countedFrom={totals?.countedFrom}
      />
      <KpiCard
        label={COPY.pageViews}
        value={totals?.pageViews ?? 0}
        money={false}
        icon="eye"
        hint={COPY.pageViewsHint}
        loading={totals === undefined}
      />
    </div>
  );
}
