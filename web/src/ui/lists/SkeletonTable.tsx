// SPEC-GAP: SkeletonTable (UI-SPEC "SPEC-GAP Primitive Specs" → Skeleton family + LoadingRegion; spec §8.5 "Table view
// uses 4 skeleton rows"; WEB-06). The first-load placeholder of a ResponsiveTable: the same frame, table, header row
// and cell looks with 4 rows of Skeleton bars (60% in money cells, 80% elsewhere, a 72px bar for the actions), so the
// real rows land without a shift and phones show skeleton cards. The whole frame is aria-hidden and never focusable;
// the LoadingRegion around it announces the load.
import clsx from 'clsx';
import { Skeleton } from '@/ui/feedback';
import { srOnlyClasses } from '@/ui/layout/layout.recipe';
import {
  bodyCellBorderClasses,
  bodyCellKindClasses,
  bodyCellToneClasses,
  cellSharedClasses,
  moneyCellClasses,
  tableClasses,
  tableHeadCellClasses,
  tableHeadClasses,
  tableRowClasses,
  tableSectionClasses,
  tableWrapClasses,
} from './lists.recipe';
import { headSide, kindOf, type ResponsiveTableColumn } from './columns';

/** What a skeleton needs of a column: its header, label and kind. */
export type SkeletonTableColumn = Pick<
  ResponsiveTableColumn<never>,
  'key' | 'header' | 'label' | 'lead' | 'actions' | 'money'
>;

export interface SkeletonTableProps {
  columns: readonly SkeletonTableColumn[];
}

/** The four skeleton rows (spec §8.5). */
const SKELETON_ROWS = [0, 1, 2, 3] as const;

function barWidth(column: SkeletonTableColumn): number | string {
  if (column.actions === true) return 72;
  return column.money === true ? '60%' : '80%';
}

export function SkeletonTable({ columns }: SkeletonTableProps) {
  return (
    <div className={tableWrapClasses} aria-hidden="true">
      <table className={tableClasses}>
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
          {SKELETON_ROWS.map((index) => (
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
