// DataTable (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4), converted to utilities (D-33) with the App. D.3 props,
// markup and copy: the `.csp-table` frame and table, a visually hidden caption, a header row, then four skeleton rows
// while loading, the error row, the empty row ("Nothing here yet." unless `empty` is given) or the data rows. Money
// columns go through formatPeso in the tabular number look. List screens use ResponsiveTable (the WEB-06 table);
// this keeps the approved `.csp-table` look. The looks are in data.recipe.ts.
// SPEC-DEVIATION: D-33 strict CSP: App. D.3's inline `textAlign` becomes the `align` class map, and the header `width`
// goes through the `--col-w` custom property read by `w-(--col-w)` (UI-SPEC "Inline style rule"). Numbers become px
// as React did for `width`.
// SPEC-DEVIATION: A11Y-01 (axe scrollable-region-focusable, WCAG 2.1.1) the frame scrolls sideways on narrow screens,
// so it is a named, focusable region (`role="region"`, `tabIndex={0}`, named by the caption) that a keyboard user can
// scroll with the arrow keys. Attributes only; the look at rest is unchanged.
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { formatPeso } from '@/lib/csps';
import { Icon } from '@/ui/brand';
import { Skeleton } from '@/ui/feedback';
import { srOnlyClasses } from '@/ui/layout/layout.recipe';
import {
  tableAlignClasses,
  tableCellClasses,
  tableClasses,
  tableColumnWidthClasses,
  tableHeadCellClasses,
  tableNumberCellClasses,
  tableRowClasses,
  tableStateClasses,
  tableStateToneClasses,
  tableWrapClasses,
  type CellAlign,
} from './data.recipe';

export interface DataTableColumn<R> {
  key: string;
  label: ReactNode;
  /** Text alignment of the column (default left). */
  align?: CellAlign | undefined;
  /** The header width: a number is px, a string any CSS length. */
  width?: number | string | undefined;
  /** Format the cell with formatPeso in the tabular number look. */
  money?: boolean | undefined;
  render?: ((row: R) => ReactNode) | undefined;
}

export interface DataTableProps<R> {
  columns: DataTableColumn<R>[];
  rows: R[];
  rowKey?: (keyof R & string) | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;
  empty?: ReactNode;
  caption?: string | undefined;
}

/** The four skeleton rows of the loading state. */
const SKELETON_ROWS = [0, 1, 2, 3] as const;

/** A CSS length: React's px rule for numbers, strings as given. */
function length(value: number | string): string {
  return typeof value === 'number' ? `${String(value)}px` : value;
}

/** The column's alignment class: App. D.3's `c.align || 'left'`. */
function alignClasses<R>(column: DataTableColumn<R>): string {
  return tableAlignClasses[column.align ?? 'left'];
}

/** The cell content as App. D.3 writes it: the render function, a formatted amount, or the raw value. */
function cellContent<R extends Record<string, unknown>>(column: DataTableColumn<R>, row: R): ReactNode {
  if (column.render) return column.render(row);
  return column.money ? formatPeso(row[column.key] as number) : (row[column.key] as ReactNode);
}

// SPEC-DEVIATION: lint no-useless-default-assignment. App. D.3's `columns = []` and `rows = []` defaults are dropped:
// both props are required by its own types. Same output for every typed call.
export function DataTable<R extends Record<string, unknown>>({
  columns,
  rows,
  loading = false,
  error,
  empty,
  rowKey,
  caption,
}: DataTableProps<R>) {
  return (
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a sideways-scrolling region must take keyboard focus (WCAG 2.1.1)
    <div className={tableWrapClasses} role="region" tabIndex={0} aria-label={caption}>
      <table className={tableClasses}>
        {caption && <caption className={srOnlyClasses}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  tableHeadCellClasses,
                  alignClasses(column),
                  column.width !== undefined && tableColumnWidthClasses,
                )}
                style={{ '--col-w': column.width === undefined ? undefined : length(column.width) }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            SKELETON_ROWS.map((index) => (
              <tr key={`sk${String(index)}`} className={tableRowClasses} aria-hidden="true">
                {columns.map((column) => (
                  <td key={column.key} className={tableCellClasses}>
                    <Skeleton width={column.align === 'right' ? '60%' : '80%'} height={14} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && error && (
            <tr className={tableRowClasses}>
              <td colSpan={columns.length} className={tableCellClasses}>
                <div className={clsx(tableStateClasses, tableStateToneClasses.error)}>
                  <Icon name="triangle-alert" size={18} />
                  {error}
                </div>
              </td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr className={tableRowClasses}>
              <td colSpan={columns.length} className={tableCellClasses}>
                {empty || <div className={clsx(tableStateClasses, tableStateToneClasses.empty)}>Nothing here yet.</div>}
              </td>
            </tr>
          )}
          {!loading &&
            !error &&
            rows.map((row, index) => (
              <tr key={rowKey ? String(row[rowKey]) : index} className={tableRowClasses}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(tableCellClasses, alignClasses(column), column.money && tableNumberCellClasses)}
                  >
                    {cellContent(column, row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
