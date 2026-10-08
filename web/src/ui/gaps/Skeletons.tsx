// SPEC-GAP: Skeleton family (02-UI-SPEC SPEC-GAP "Skeleton family + LoadingRegion"; WEB-06). Wrappers over the App.
// D.3 Skeleton for first loads only. Every skeleton is aria-hidden; the LoadingRegion around it announces the load.
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Skeleton } from '@/ui';

/** What a skeleton table needs from a column. ResponsiveTable columns fit as they are. */
export interface SkeletonTableColumn {
  key: string;
  header: ReactNode;
  /** The phone card label (data-label); the header text by default. */
  label?: string;
  money?: boolean;
  actions?: boolean;
  lead?: boolean;
}

export interface SkeletonTableProps {
  columns: readonly SkeletonTableColumn[];
  /** Placeholder rows; 4 by default (02-UI-SPEC). */
  rows?: number;
}

/** The table's own layout, inside .s-rt-wrap, so the real rows replace it without a layout jump. */
export function SkeletonTable({ columns, rows = 4 }: SkeletonTableProps) {
  return (
    <div className="s-rt-wrap" aria-hidden="true">
      <table className="s-rt">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={clsx((column.money || column.actions) && 'r')}>
                {column.actions ? <span className="csp-sr">{column.header}</span> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.label ?? (typeof column.header === 'string' ? column.header : '')}
                  className={clsx(column.lead && 'is-lead', column.actions && 'r is-acts', column.money && 'r m')}
                >
                  <Skeleton width={column.actions ? 36 : column.money ? '60%' : '80%'} height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
