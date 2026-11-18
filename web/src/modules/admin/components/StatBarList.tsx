// A ranked list with the server's counts and shares (UI-SPEC V1 items 5 to 7; ANL-08, D-28). SPEC-GAP: StatBarList.
// Each row: the name, "412 · 38%" and an 8px bar filled to the server's share. Names render as text, never as links.
import { statusTrackClasses } from '@/modules/admin/components/dashboard.recipe';
import {
  statBarEmptyClasses,
  statBarFigureClasses,
  statBarFillClasses,
  statBarHeadClasses,
  statBarListClasses,
  statBarNameClasses,
  statBarRowClasses,
} from '@/modules/admin/components/visitorStats.recipe';
import type { RankedItem } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { formatCount } from '@/utils/format';

export interface StatBarListProps {
  /** The rows in the server's order. */
  items: readonly RankedItem[];
  /** The shown name for a stored one; the stored name when absent. */
  labelFor?: ((name: string) => string) | undefined;
  /** The line shown when there are no rows. */
  emptyText: string;
}

export function StatBarList({ items, labelFor, emptyText }: StatBarListProps) {
  if (items.length === 0) {
    return <p className={statBarEmptyClasses}>{emptyText}</p>;
  }
  return (
    <ol className={statBarListClasses}>
      {items.map((item) => (
        <li key={item.name} className={statBarRowClasses}>
          <div className={statBarHeadClasses}>
            <span className={statBarNameClasses} data-stat-name="">
              {labelFor === undefined ? item.name : labelFor(item.name)}
            </span>
            <span className={statBarFigureClasses} data-stat-figure="">
              {VISITOR_STATS_COPY.lists.figure(formatCount(item.count), item.share)}
            </span>
          </div>
          <span className={statusTrackClasses} aria-hidden="true">
            <span className={statBarFillClasses} style={{ '--bar-w': `${String(item.share)}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
