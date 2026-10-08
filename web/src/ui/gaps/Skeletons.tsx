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

/** Three text lines, 14px high at 100%, 90% and 60%, 8px apart. */
export function SkeletonText() {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gap: 8 }}>
      <Skeleton width="100%" height={14} />
      <Skeleton width="90%" height={14} />
      <Skeleton width="60%" height={14} />
    </div>
  );
}

/** The App. E.8 order-card skeleton, verbatim: the media block, then the number, team, customer and totals lines. */
export function SkeletonCard() {
  return (
    <div className="csp-card" style={{ overflow: 'hidden' }} aria-hidden="true">
      <Skeleton height={180} radius={0} />
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="75%" height={22} />
        <Skeleton width="55%" height={14} />
        <Skeleton height={56} />
      </div>
    </div>
  );
}

export interface SkeletonImageProps {
  /** The image's aspect ratio, reserved so the real image lands without a shift; 4 / 3 like MediaPlaceholder. */
  ratio?: string;
  className?: string;
}

/** A full-box, radius-0 Skeleton in a box with the image's aspect ratio. */
export function SkeletonImage({ ratio = '4 / 3', className }: SkeletonImageProps) {
  return (
    <div className={className} style={{ aspectRatio: ratio }} aria-hidden="true">
      <Skeleton width="100%" height="100%" radius={0} />
    </div>
  );
}
