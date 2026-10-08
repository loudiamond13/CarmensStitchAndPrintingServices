// SPEC-GAP: ResponsiveTable (02-UI-SPEC SPEC-GAP "ResponsiveTable"; WEB-06, WEB-08, A11Y-01, PERF-03). The WEB-06
// "DataTable": exactly the App. E.7/E.12 list markup, .s-rt-wrap > table.s-rt with a .csp-sr caption, data-label on
// every td, td.is-lead for the card title, td.r.is-acts under a .csp-sr "Actions" header, .r.m money cells and an
// optional tfoot. The verbatim screens.css turns it into scrolling columns on tablets and stacked cards on phones
// (spec section 8.4). It also owns the list states: first-load skeletons, the error banner, the empty and no-match
// states, and the dimmed-in-place refetch.
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Button, EmptyState, type IconName } from '@/ui';
import { LIST_COPY } from './copy';
import { ErrorState } from './ErrorState';
import { LoadingRegion } from './LoadingRegion';
import { SkeletonTable } from './Skeletons';
import { useDelayedFlag } from './useDelayedFlag';

export interface ResponsiveColumn<T> {
  key: string;
  /** The column header text; also the phone card label unless `label` is given. */
  header: string;
  /** The cell content. null, undefined, false or '' renders "—" (spec section 9.4). */
  render: (row: T) => ReactNode;
  /** The phone card label (data-label), when it differs from the header ("Customer / team" -> "Customer"). */
  label?: string;
  /** The card title on phones: td.is-lead. */
  lead?: boolean;
  /** A right-aligned tabular money cell: th.r and td.r.m. */
  money?: boolean;
  /** The row actions: a .csp-sr header and td.r.is-acts. */
  actions?: boolean;
  /** Extra td classes, like 's-muted'. */
  className?: string;
}

/** Where the list is: the first load, a failed load, no rows, or rows to show. */
export type ListStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface ResponsiveTableProps<T> {
  /** Names the list for screen readers (the .csp-sr caption), like "Users". */
  caption: string;
  /** Makes the caption a focus target (tabindex -1), for Pagination's focusTargetId. */
  captionId?: string;
  columns: readonly ResponsiveColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** Inactive rows get tr.is-inactive, muted by colour only (D-02). */
  isRowInactive?: (row: T) => boolean;
  status: ListStatus;
  /** The plural noun, like "users". */
  things: string;
  /** The query error, for the ErrorState reference. */
  error?: unknown;
  /** The query's refetch, behind "Try Again". */
  onRetry?: () => void;
  /** Any filter differs from its default. Search text counts as a filter too. */
  hasActiveFilters?: boolean;
  searchText?: string | null;
  /** The no-match sentence's filter part, like "status Ready". */
  filterSummary?: string;
  /** Behind the no-match "Clear Filters" button. */
  onClearFilters?: () => void;
  /** The first-use EmptyState icon (the list's nav icon). */
  emptyIcon?: IconName;
  /** The first-use body, like "Create your first order to start tracking items, payments and balances." */
  emptyMessage?: ReactNode;
  /** The one primary first-use action, like a "New Order" button. */
  emptyAction?: ReactNode;
  /** TanStack Query's isPlaceholderData: the rows on screen belong to the previous key (WEB-08). */
  isPlaceholderData?: boolean;
  /** Rows for an optional tfoot. */
  footer?: ReactNode;
}

/** The time placeholder rows may show before they are marked as refreshing (02-UI-SPEC, owner probe). */
const REFETCH_MARK_DELAY_MS = 200;

function isMissing(content: ReactNode): boolean {
  return content === null || content === undefined || content === false || content === '';
}

export function ResponsiveTable<T>({
  caption,
  captionId,
  columns,
  rows,
  getRowKey,
  isRowInactive,
  status,
  things,
  error,
  onRetry,
  hasActiveFilters = false,
  searchText,
  filterSummary,
  onClearFilters,
  emptyIcon,
  emptyMessage,
  emptyAction,
  isPlaceholderData = false,
  footer,
}: ResponsiveTableProps<T>) {
  const hasRows = rows.length > 0;
  const firstLoad = status === 'loading' && !hasRows;
  const empty = (status === 'empty' || status === 'ready') && !hasRows;
  const refetching = useDelayedFlag(isPlaceholderData && hasRows, REFETCH_MARK_DELAY_MS);
  const filtered = hasActiveFilters || (searchText?.trim() ?? '') !== '';

  let body: ReactNode = null;
  if (firstLoad) {
    body = <SkeletonTable columns={columns} />;
  } else if (empty) {
    body = filtered ? (
      <EmptyState
        icon="search"
        title={LIST_COPY.noMatchesTitle}
        message={LIST_COPY.noMatchesBody(things, searchText, filterSummary)}
        action={<Button onClick={onClearFilters}>{LIST_COPY.clearFilters}</Button>}
      />
    ) : (
      <EmptyState
        {...(emptyIcon === undefined ? {} : { icon: emptyIcon })}
        title={LIST_COPY.emptyTitle(things)}
        message={emptyMessage}
        action={emptyAction}
      />
    );
  } else if (hasRows) {
    body = (
      <div className={clsx('s-rt-wrap', refetching && 'is-refetching')}>
        <table className="s-rt">
          <caption className="csp-sr" id={captionId} tabIndex={captionId === undefined ? undefined : -1}>
            {caption}
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={clsx((column.money || column.actions) && 'r')}>
                  {column.actions ? <span className="csp-sr">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className={clsx(isRowInactive?.(row) && 'is-inactive')}>
                {columns.map((column) => {
                  const content = column.render(row);
                  return (
                    <td
                      key={column.key}
                      data-label={column.label ?? column.header}
                      className={clsx(
                        column.lead && 'is-lead',
                        column.money && 'r m',
                        column.actions && 'r is-acts',
                        column.className,
                      )}
                    >
                      {isMissing(content) ? LIST_COPY.missing : content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {footer !== undefined && footer !== null && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    );
  }

  return (
    <LoadingRegion busy={firstLoad || refetching} things={things} className="csp-list-region">
      {status === 'error' && <ErrorState things={things} error={error} onRetry={onRetry} />}
      {body}
    </LoadingRegion>
  );
}

/** The App. E.7 customer cell: the team over the customer, or the customer over "Walk-in customer" (spec 8.3). */
export function CustomerCell({ team, customer }: { team?: string | null | undefined; customer: string }) {
  return (
    <div className="s-who">
      <strong>{team || customer}</strong>
      <span>{team ? customer : LIST_COPY.walkIn}</span>
    </div>
  );
}
