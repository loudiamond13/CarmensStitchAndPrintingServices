// A1 Audit Log, /admin/audit-log (UI-SPEC "A1 Audit Log"; AUDIT-02, D-26..D-29, D-40, WEB-10; plan 05-33). The Manager-only
// list of audited events, newest first: the `.s-ph` header with the "Manager only" badge, the result bar, a ResponsiveTable
// whose rows expand to their detail (several at once), and Pagination. There is no export and no header action (D-29).
//   - The range and the page live in the URL through useAuditListParams and nowhere else. The range is stored by name and
//     worked out against the business today, read once when the page opens; the query keys on the resolved business days.
//   - The open rows are component state only: they are not in the URL (D-27).
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 for a role lost mid-session, and the page
//     then shows the "You don't have access to this" banner instead of the table.
//   - With no entries in the default 7 days the page offers "Show Everything Kept" (range=all); any other empty result is the
//     table's "No matches" with Clear Filters.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { ActorName } from '@/components/data';
import { EmptyState } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import {
  FilterChip,
  Pagination,
  ResponsiveTable,
  ResultBar,
  RowAction,
  RowActions,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { businessToday } from '@/lib/url-state/parsers';
import { AUDIT_COPY, auditActionLabel } from '@/modules/admin/auditCopy';
import { DEFAULT_AUDIT_RANGE, resolveAuditRange } from '@/modules/admin/auditRange';
import { auditTitleRowClasses } from '@/modules/admin/components/audit.recipe';
import { AuditDetail } from '@/modules/admin/components/AuditDetail';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useAuditListParams } from '@/modules/admin/hooks/useAuditListParams';
import { useAuditLogQuery } from '@/modules/admin/hooks/useAuditLogQuery';
import type { AuditLogItem } from '@/modules/admin/services/auditLogService';
import { describeHttpError } from '@/utils/describeHttpError';
import { formatBusinessDateTime } from '@/utils/format';

const COPY = AUDIT_COPY;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'audit-results';

function rowKey(item: AuditLogItem): string {
  return String(item.id);
}

function detailId(item: AuditLogItem): string {
  return `audit-detail-${rowKey(item)}`;
}

/** "Oct 12, 2026, 3:42 PM" for the toggle's name; the raw instant when it cannot be formatted. */
function whenText(item: AuditLogItem): string {
  return formatBusinessDateTime(item.occurredAt) ?? item.occurredAt;
}

function DoneBy({ item }: { item: AuditLogItem }) {
  if (item.doneBy.kind === 'unknown-account') {
    return COPY.unknownAccount;
  }
  return <ActorName actor={item.doneBy.person} />;
}

function columnsFor(
  expanded: ReadonlySet<string>,
  toggle: (key: string) => void,
): readonly ResponsiveTableColumn<AuditLogItem>[] {
  return [
    {
      key: 'when',
      header: COPY.columns.when,
      lead: true,
      cell: (item) => {
        const text = formatBusinessDateTime(item.occurredAt);
        return text === null ? null : <time dateTime={item.occurredAt}>{text}</time>;
      },
    },
    { key: 'doneBy', header: COPY.columns.doneBy, cell: (item) => <DoneBy item={item} /> },
    { key: 'action', header: COPY.columns.action, cell: (item) => auditActionLabel(item.action) },
    {
      key: 'doneTo',
      header: COPY.columns.doneTo,
      cell: (item) => (item.doneTo === null ? null : <ActorName actor={item.doneTo} />),
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const open = expanded.has(rowKey(item));
        const action = auditActionLabel(item.action);
        return (
          <RowActions>
            <RowAction
              icon="chevron-down"
              label={open ? COPY.toggle.hide(action, whenText(item)) : COPY.toggle.show(action, whenText(item))}
              expanded={open}
              controls={detailId(item)}
              onClick={() => {
                toggle(rowKey(item));
              }}
            />
          </RowActions>
        );
      },
    },
  ];
}

export function AuditLogRoute() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [values, set] = useAuditListParams();
  const settled = useSettledListParams(values, 300);
  // The business today, read once when the page opens (WEB-10): a preset is worked out from it, never stored.
  const [today] = useState(() => businessToday(new Date()));
  const dates = resolveAuditRange(settled, today);
  const query = useAuditLogQuery({
    from: dates.from,
    to: dates.to,
    actor: null,
    action: null,
    target: null,
    page: settled.page,
    pageSize: settled.size,
  });
  // The rows whose detail is open: page state only, never in the URL (D-27).
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  // The generated type allows a number or text for an int32; the server sends a number.
  const total = Number(query.data?.total ?? 0);
  const pageCount = Math.ceil(total / values.size);

  // A page past the last one (a stale link) becomes the last page, once fresh data says so.
  const { clampPage } = set;
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  const toggle = (key: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  };

  const forbidden = isHttpError(query.error) && query.error.status === 403;
  const denied = forbidden ? describeHttpError(query.error) : null;
  const filtered = values.range !== DEFAULT_AUDIT_RANGE;
  const emptyDefault = fresh && total === 0 && !filtered;

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={auditTitleRowClasses}>
            <h1 id={HEADING_ID} ref={headingRef} tabIndex={-1} className={pageTitleClasses}>
              {COPY.title}
            </h1>
            <Badge tone="accent" icon="shield-check">
              {COPY.badge}
            </Badge>
          </div>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      {denied === null ? (
        <>
          <ResultBar count={total} thing={COPY.thing} things={COPY.things} orderNote={COPY.orderNote}>
            {filtered && (
              <FilterChip
                label="Range"
                value={COPY.ranges[values.range]}
                onClear={() => {
                  set.setFilters({ range: null, from: null, to: null });
                }}
              />
            )}
          </ResultBar>
          {emptyDefault ? (
            <EmptyState
              icon="history"
              title={COPY.empty.title}
              message={COPY.empty.message}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    set.setFilter('range', 'all');
                  }}
                >
                  {COPY.empty.showAll}
                </Button>
              }
            />
          ) : (
            <ResponsiveTable<AuditLogItem>
              caption={COPY.caption}
              columns={columnsFor(expanded, toggle)}
              rows={query.data?.items}
              rowKey={rowKey}
              detail={(item) => <AuditDetail item={item} id={detailId(item)} />}
              expandedKeys={expanded}
              things={COPY.tableThings}
              pending={query.isPending}
              refetching={query.isPlaceholderData && query.isFetching}
              failed={query.isError}
              error={query.error}
              onRetry={() => {
                void query.refetch();
              }}
              filtered={filtered}
              filterSummary={`range ${COPY.ranges[values.range]}`}
              onClearFilters={() => {
                set.setFilters({ range: null, from: null, to: null });
              }}
            />
          )}
          <Pagination
            page={values.page}
            pageCount={pageCount}
            onPageChange={set.setPage}
            focusTargetId={HEADING_ID}
            pageSize={values.size}
            onPageSizeChange={set.setPageSize}
          />
        </>
      ) : (
        <ErrorState title={denied.title} message={denied.body} error={query.error} />
      )}
    </>
  );
}
