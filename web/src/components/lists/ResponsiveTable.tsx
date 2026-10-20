// SPEC-GAP: ResponsiveTable (UI-SPEC "SPEC-GAP Primitive Specs" → ResponsiveTable; spec §8.4; App. E.7/E.12 list-table
// markup; WEB-06, WEB-08, A11Y-01, D-02, D-38). The WEB-06 list table: exactly the App. E list structure (the
// `.s-rt-wrap` frame > a `.s-rt` table with a visually hidden caption naming the list, a visually hidden "Actions"
// header, `data-label` on every cell, a lead cell for the card title, an actions cell, end-aligned tabular money
// cells and an optional tfoot). The pg-phone utilities turn it into stacked cards on phones; on tablets it keeps its
// columns and scrolls sideways inside the frame, which is therefore a named, focusable region (axe
// scrollable-region-focusable, WCAG 2.1.1). It owns the list states:
//   - the first load: SkeletonTable (4 rows) in a busy LoadingRegion that announces "Loading {things}…";
//   - a failed load: ErrorState above the table (the previous rows stay below it when there are any);
//   - no rows: the first-use EmptyState ("No {things} yet" + one primary action), or "No matches" + Clear Filters when
//     a filter or a search is active;
//   - a refetch (placeholder rows while the next key loads, WEB-08): the rows stay and, after 200 ms, the frame gets
//     `data-refetching="true"`, which dims every cell and phone card to --surface-2 by colour only (D-02), with
//     aria-busy and the polite announcement.
// Cell text is rendered as React text nodes only, and each `data-label` comes from the column definition, never from
// row data (T-02-68). The looks are in lists.recipe.ts.
import clsx from 'clsx';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/actions';
import type { IconName } from '@/components/brand';
import { EmptyState, type EmptyStateHeadingLevel } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { PaintContainmentContext } from '@/components/overlays/fixedLayerGuard';
import { EmptyValue, ErrorState, LoadingRegion, useDelayedFlag } from '@/components/states';
import { LISTS_COPY } from './copy';
import {
  bodyCellBorderClasses,
  bodyCellKindClasses,
  bodyCellToneClasses,
  cellSharedClasses,
  detailCellClasses,
  detailParentCellClasses,
  detailRowClasses,
  footCellClasses,
  footCellKindClasses,
  moneyCellClasses,
  mutedCellClasses,
  openRowClasses,
  tableClasses,
  tableFootRowClasses,
  tableHeadCellClasses,
  tableHeadClasses,
  tableRowClasses,
  tableSectionClasses,
  tableWrapClasses,
} from './lists.recipe';
import { headSide, kindOf, type ResponsiveTableColumn } from './columns';
import { SkeletonTable } from './SkeletonTable';

export type { ResponsiveTableColumn } from './columns';

export interface ResponsiveTableProps<T> {
  /** Names the list for assistive technology: the visually hidden caption and the frame's region name. */
  caption: string;
  /** Makes the caption a focus target (tabIndex -1), for Pagination's `focusTargetId`. */
  captionId?: string | undefined;
  columns: readonly ResponsiveTableColumn<T>[];
  /** The rows on screen; undefined while no data has arrived yet. */
  rows: readonly T[] | undefined;
  rowKey: (row: T) => string;
  /** Inactive rows sit on --surface-2 by colour only (D-02). */
  isInactive?: ((row: T) => boolean) | undefined;
  /** The plural noun, like "users", for the states and the announcements. */
  things: string;
  /** The first load is running (TanStack Query's isPending). */
  pending?: boolean | undefined;
  /** The rows are the previous key's while the next one loads (isPlaceholderData && isFetching, WEB-08). */
  refetching?: boolean | undefined;
  /** The load failed (isError); `error` may carry a traceId for the reference line. */
  failed?: boolean | undefined;
  error?: unknown;
  /** The query's refetch, behind "Try Again". */
  onRetry?: (() => void) | undefined;
  /** A filter differs from its default. A search on its own counts too. */
  filtered?: boolean | undefined;
  search?: string | null | undefined;
  /** The no-match sentence's filter part, like "status Ready". */
  filterSummary?: string | undefined;
  /** Behind the no-match "Clear Filters" button. */
  onClearFilters?: (() => void) | undefined;
  /** The first-use icon (the list's nav icon). */
  emptyIcon?: IconName | undefined;
  /** The first-use body, like "Create your first order to start tracking items, payments and balances." */
  emptyMessage?: ReactNode;
  /** The one primary first-use action, like a "New Order" button. */
  emptyAction?: ReactNode;
  /** The empty state's heading level; the default 2 follows the page h1. */
  emptyLevel?: EmptyStateHeadingLevel | undefined;
  /** One totals row, by column key; a missing key leaves its cell empty. */
  footer?: Readonly<Record<string, ReactNode>> | undefined;
  /** D-27: a row's expandable details. The toggle is the caller's RowAction; the table only renders the detail row. */
  detail?: ((row: T) => ReactNode) | undefined;
  /** The keys of the rows whose detail is open. */
  expandedKeys?: ReadonlySet<string> | undefined;
  /** Called by the caller's toggle with the row key; kept for the caller's wiring. */
  onToggleRow?: ((key: string) => void) | undefined;
}

/** How long placeholder rows may show before they are marked as refreshing (UI-SPEC "refetch", owner probe). */
const REFETCH_MARK_DELAY_MS = 200;

function isMissing(content: ReactNode): boolean {
  return content === null || content === undefined || content === false || content === '';
}

function labelOf<T>(column: ResponsiveTableColumn<T>): string {
  return column.label ?? column.header;
}

function headCell<T>(column: ResponsiveTableColumn<T>): ReactNode {
  return (
    <th key={column.key} scope="col" className={tableHeadCellClasses[headSide(column)]}>
      {column.actions === true ? <span className={srOnlyClasses}>{column.header}</span> : column.header}
    </th>
  );
}

type RowTone = keyof typeof tableRowClasses;

function toneOf(inactive: boolean): RowTone {
  return inactive ? 'inactive' : 'active';
}

function bodyCellClasses<T>(column: ResponsiveTableColumn<T>, tone: RowTone, hasDetail: boolean): string {
  return clsx(
    cellSharedClasses,
    bodyCellBorderClasses,
    bodyCellKindClasses[kindOf(column)],
    bodyCellToneClasses[tone],
    column.money === true && moneyCellClasses,
    column.muted === true && mutedCellClasses,
    hasDetail && detailParentCellClasses,
  );
}

function footCellClassList<T>(column: ResponsiveTableColumn<T>): string {
  return clsx(
    cellSharedClasses,
    footCellClasses,
    footCellKindClasses[kindOf(column)],
    column.money === true && moneyCellClasses,
  );
}

export function ResponsiveTable<T>({
  caption,
  captionId,
  columns,
  rows,
  rowKey,
  isInactive,
  things,
  pending = false,
  refetching = false,
  failed = false,
  error,
  onRetry,
  filtered = false,
  search,
  filterSummary,
  onClearFilters,
  emptyIcon,
  emptyMessage,
  emptyAction,
  emptyLevel,
  footer,
  detail,
  expandedKeys,
}: ResponsiveTableProps<T>) {
  const shown = rows ?? [];
  const hasRows = shown.length > 0;
  const firstLoad = pending && !hasRows;
  const marked = useDelayedFlag(refetching && hasRows, REFETCH_MARK_DELAY_MS);
  const empty = !pending && !failed && !hasRows;
  const narrowed = filtered || (search?.trim() ?? '') !== '';

  let body: ReactNode = null;
  if (firstLoad) {
    body = <SkeletonTable columns={columns} />;
  } else if (empty) {
    body = narrowed ? (
      <EmptyState
        icon="search"
        level={emptyLevel}
        title={LISTS_COPY.noMatchesTitle}
        message={LISTS_COPY.noMatchesBody(things, search, filterSummary)}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              onClearFilters?.();
            }}
          >
            {LISTS_COPY.clearFilters}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={emptyIcon}
        level={emptyLevel}
        title={LISTS_COPY.emptyTitle(things)}
        message={emptyMessage}
        action={emptyAction}
      />
    );
  } else if (hasRows) {
    body = (
      <div
        className={tableWrapClasses}
        role="region"
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a sideways-scrolling region must take keyboard focus (WCAG 2.1.1)
        tabIndex={0}
        aria-label={caption}
        data-refetching={marked ? 'true' : undefined}
      >
        {/* WR-05: the frame's D-41 R2-02 paint containment makes it the containing block of position: fixed
            descendants, so a dialog in a cell would be trapped and clipped. The context (no DOM) makes Modal and
            ConfirmDialog refuse to render here; see fixedLayerGuard.ts. */}
        <PaintContainmentContext value>
          <table className={tableClasses}>
            <caption id={captionId} tabIndex={captionId === undefined ? undefined : -1} className={srOnlyClasses}>
              {caption}
            </caption>
            <thead className={tableHeadClasses}>
              <tr>{columns.map((column) => headCell(column))}</tr>
            </thead>
            <tbody className={tableSectionClasses}>
              {shown.map((row, index) => {
                const key = rowKey(row);
                const tone = toneOf(isInactive?.(row) ?? false);
                const hasDetail = detail !== undefined;
                const open = hasDetail && (expandedKeys?.has(key) ?? false);
                const last = index === shown.length - 1;
                return (
                  <Fragment key={key}>
                    <tr
                      className={open ? openRowClasses[tone] : tableRowClasses[tone]}
                      data-edge={hasDetail && (open || last) ? 'true' : undefined}
                    >
                      {columns.map((column) => {
                        const content = column.cell(row);
                        return (
                          <td
                            key={column.key}
                            data-label={labelOf(column)}
                            className={bodyCellClasses(column, tone, hasDetail)}
                          >
                            {column.actions !== true && isMissing(content) ? <EmptyValue /> : content}
                          </td>
                        );
                      })}
                    </tr>
                    {hasDetail && (
                      <tr hidden={!open} className={detailRowClasses}>
                        <td colSpan={columns.length} data-label="Details" className={detailCellClasses}>
                          {detail(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {footer !== undefined && (
              <tfoot className={tableSectionClasses}>
                <tr className={tableFootRowClasses}>
                  {columns.map((column) => (
                    <td key={column.key} data-label={labelOf(column)} className={footCellClassList(column)}>
                      {footer[column.key]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </PaintContainmentContext>
      </div>
    );
  }

  return (
    <>
      {failed && <ErrorState things={things} error={error} onRetry={onRetry} />}
      <LoadingRegion loading={firstLoad || marked} things={things} failed={failed}>
        {body}
      </LoadingRegion>
    </>
  );
}
