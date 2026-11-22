// The one KPI card of Visitor Stats: Page views (UI-SPEC V1 item 3; ANL-08, D-57). SPEC-GAP: V1. The count is the server's; the
// card only groups it en-PH.
import { KpiCard } from '@/components';
import { visitorKpiRowClasses } from '@/modules/admin/components/visitorStats.recipe';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';

const COPY = VISITOR_STATS_COPY.kpis;

export interface VisitorKpiRowProps {
  /** Undefined while the first read runs. */
  pageViews: number | undefined;
}

export function VisitorKpiRow({ pageViews }: VisitorKpiRowProps) {
  return (
    <div className={visitorKpiRowClasses}>
      <KpiCard
        label={COPY.pageViews}
        value={pageViews ?? 0}
        money={false}
        icon="eye"
        hint={COPY.pageViewsHint}
        loading={pageViews === undefined}
      />
    </div>
  );
}
