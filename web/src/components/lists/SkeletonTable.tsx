// SPEC-GAP: SkeletonTable (UI-SPEC "SPEC-GAP Primitive Specs" → Skeleton family + LoadingRegion; spec §8.5 "Table view
// uses 4 skeleton rows"; WEB-06). The first-load placeholder of a ResponsiveTable: the same frame, table, header row
// and cell looks with 4 rows of Skeleton bars (60% in money cells, 80% elsewhere, a 72px bar for the actions), so the
// real rows land without a shift and phones show skeleton cards. The whole frame is aria-hidden and never focusable;
// the LoadingRegion around it announces the load.
import clsx from 'clsx';
import { Skeleton } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  bodyCellBorderClasses,
  bodyCellKindClasses,
  bodyCellToneClasses,
  cellSharedClasses,
  moneyCellClasses,
  tableClasses,
  tableFitTabletClasses,
  tableHeadCellClasses,
  tableHeadClasses,
  tableRowClasses,
  tableSectionClasses,
  tableWrapClasses,
  tableWrapEmbeddedClasses,
} from './lists.recipe';
import { headSide, kindOf, type ResponsiveTableColumn } from './columns';

/** What a skeleton needs of a column: its header, label and kind. */
export type SkeletonTableColumn = Pick<
  ResponsiveTableColumn<never>,
  'key' | 'header' | 'label' | 'lead' | 'actions' | 'money'
>;

export interface SkeletonTableProps {
  columns: readonly SkeletonTableColumn[];
  /** No 680px floor on tablets (as on ResponsiveTable). */
  fitTablet?: boolean | undefined;
  /** How many skeleton rows: 4 by default (spec 8.5); a card that lists a fixed count shows that many. */
  rows?: number | undefined;
  /** The frame sits in a card that draws the border (as on ResponsiveTable). */
  embedded?: boolean | undefined;
}

/** The skeleton rows when none are asked for (spec §8.5). */
const DEFAULT_ROWS = 4;

function barWidth(column: SkeletonTableColumn): number | string {
  if (column.actions === true) return 72;
  return column.money === true ? '60%' : '80%';
}

export function SkeletonTable({
  columns,
  fitTablet = false,
  rows = DEFAULT_ROWS,
  embedded = false,
}: SkeletonTableProps) {
  return (
    <div className={embedded ? tableWrapEmbeddedClasses : tableWrapClasses} aria-hidden="true">
      <table className={fitTablet ? tableFitTabletClasses : tableClasses}>
        <thead className={tableHeadClasses}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={tableHeadCellClasses[headSide(column)]}>
                {column.actions === true ? <span className={srOnlyClasses}>{column.header}</span> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tableSectionClasses}>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index} className={tableRowClasses.active}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.label ?? column.header}
                  className={clsx(
                    cellSharedClasses,
                    bodyCellBorderClasses,
                    bodyCellKindClasses[kindOf(column)],
                    bodyCellToneClasses.active,
                    column.money === true && moneyCellClasses,
                  )}
                >
                  <Skeleton width={barWidth(column)} height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
