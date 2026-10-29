// A1 Audit Log, /admin/audit-log (UI-SPEC "A1 Audit Log"; AUDIT-02, D-26..D-29, D-40, WEB-10; plan 05-33). The Manager-only
// list of audited events, newest first: the `.s-ph` header with the "Manager only" badge, the result bar, a ResponsiveTable
// whose rows expand to their detail (several at once), and Pagination. There is no export and no header action (D-29).
//   - The range, the filters and the page live in the URL through useAuditListParams and nowhere else. The range is stored by
//     name and worked out against the business today, read once when the page opens; the query keys on the resolved business
//     days and on the settled values. Done by and Done to hold user ids; their names come from the people list (D-26).
//   - The open rows are component state only: they are not in the URL (D-27).
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 for a role lost mid-session, and the page
//     then shows the "You don't have access to this" banner instead of the table.
//   - With no entries in the default 7 days and no filter the page offers "Show Everything Kept" (range=all); any other empty
//     result is the table's "No matches" with Clear Filters.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { ActorName, RECORD_META_COPY } from '@/components/data';
import { EmptyState } from '@/components/feedback';
import { Select, type SelectOption } from '@/components/forms';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import {
  FilterBar,
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
import { AUDIT_ACTIONS, AUDIT_COPY, auditActionLabel } from '@/modules/admin/auditCopy';
import { AUDIT_RANGES, DEFAULT_AUDIT_RANGE, resolveAuditRange, type AuditRange } from '@/modules/admin/auditRange';
import { auditTitleRowClasses } from '@/modules/admin/components/audit.recipe';
import { AuditCustomRange } from '@/modules/admin/components/AuditCustomRange';
import { AuditDetail } from '@/modules/admin/components/AuditDetail';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { SYSTEM_ACTOR, useAuditListParams } from '@/modules/admin/hooks/useAuditListParams';
import { useAuditLogQuery, useAuditPeopleQuery } from '@/modules/admin/hooks/useAuditLogQuery';
import type { AuditLogItem, AuditPerson } from '@/modules/admin/services/auditLogService';
import { describeHttpError } from '@/utils/describeHttpError';
import { formatBusinessDateTime } from '@/utils/format';

const COPY = AUDIT_COPY;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'audit-results';

const RANGE_OPTIONS = AUDIT_RANGES.map((value) => ({ value, label: COPY.ranges[value] }));
const ACTION_OPTIONS: SelectOption[] = AUDIT_ACTIONS.map((action) => ({
  value: action.code,
  label: action.label,
  group: action.group,
}));

function asRange(value: string): AuditRange {
  return AUDIT_RANGES.find((range) => range === value) ?? DEFAULT_AUDIT_RANGE;
}

/** A person's name, then " (former staff)" for an account that was deleted (D-47). */
function personLabel(person: AuditPerson): string {
  return `${person.name}${person.formerStaff ? RECORD_META_COPY.formerStaff : ''}`;
}

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
      cell: (item) => (item.doneTo !== null ? <ActorName actor={item.doneTo} /> : item.orderNumber),
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
    actor: settled.actor,
    action: settled.action,
    target: settled.target,
    page: settled.page,
    pageSize: settled.size,
  });
  const people = useAuditPeopleQuery();
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

  // Done by and Done to: current staff by name, then former staff, as the API lists them (D-47).
  const loadingPeople = people.isPending;
  const everyone = people.data ?? [];
  const staffOptions: SelectOption[] = [
    ...everyone.filter((person) => !person.formerStaff),
    ...everyone.filter((person) => person.formerStaff),
  ].map((person) => ({ value: person.id, label: personLabel(person) }));
  const doneByOptions: SelectOption[] = [...staffOptions, { value: SYSTEM_ACTOR, label: COPY.toolbar.system }];
  const placeholder = loadingPeople ? COPY.toolbar.loadingStaff : COPY.toolbar.anyone;
  const nameOf = (id: string): string => {
    if (id === SYSTEM_ACTOR) return COPY.toolbar.system;
    const person = everyone.find((candidate) => candidate.id.toLowerCase() === id);
    if (person !== undefined) return personLabel(person);
    return loadingPeople ? COPY.toolbar.loadingStaff : COPY.unknownPerson;
  };

  const forbidden = isHttpError(query.error) && query.error.status === 403;
  const denied = forbidden ? describeHttpError(query.error) : null;
  const rangeChanged = values.range !== DEFAULT_AUDIT_RANGE;
  const filtered = rangeChanged || values.actor !== null || values.action !== null || values.target !== null;
  const emptyDefault = fresh && total === 0 && !filtered;
  const filterSummary = COPY.filterSummary(
    [
      rangeChanged ? `range ${COPY.ranges[values.range]}` : null,
      values.actor === null ? null : `done by ${nameOf(values.actor)}`,
      values.action === null ? null : `action ${auditActionLabel(values.action)}`,
      values.target === null ? null : `done to ${nameOf(values.target)}`,
    ].filter((part): part is string => part !== null),
  );
  const clearFilters = (): void => {
    set.setFilters({ range: null, from: null, to: null, actor: null, action: null, target: null });
  };

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
          <FilterBar>
            <Select
              label={COPY.toolbar.dateRange}
              options={RANGE_OPTIONS}
              value={values.range}
              onChange={(event) => {
                set.setFilters({ range: asRange(event.target.value), from: null, to: null });
              }}
            />
            {values.range === 'custom' && (
              <AuditCustomRange
                from={values.from}
                to={values.to}
                today={today}
                onApply={(from, to) => {
                  set.setFilters({ range: 'custom', from, to });
                }}
              />
            )}
            <Select
              label={COPY.toolbar.doneBy}
              placeholder={placeholder}
              disabled={loadingPeople}
              options={doneByOptions}
              value={values.actor ?? ''}
              onChange={(event) => {
                set.setFilter('actor', event.target.value === '' ? null : event.target.value);
              }}
            />
            <Select
              label={COPY.toolbar.action}
              placeholder={COPY.toolbar.allActions}
              options={ACTION_OPTIONS}
              value={values.action ?? ''}
              onChange={(event) => {
                set.setFilter('action', event.target.value === '' ? null : event.target.value);
              }}
            />
            <Select
              label={COPY.toolbar.doneTo}
              placeholder={placeholder}
              disabled={loadingPeople}
              options={staffOptions}
              value={values.target ?? ''}
              onChange={(event) => {
                set.setFilter('target', event.target.value === '' ? null : event.target.value);
              }}
            />
          </FilterBar>
          <ResultBar count={total} thing={COPY.thing} things={COPY.things} orderNote={COPY.orderNote}>
            {rangeChanged && (
              <FilterChip
                label={COPY.chips.range}
                value={COPY.ranges[values.range]}
                onClear={() => {
                  set.setFilters({ range: null, from: null, to: null });
                }}
              />
            )}
            {values.actor !== null && (
              <FilterChip
                label={COPY.chips.doneBy}
                value={nameOf(values.actor)}
                onClear={() => {
                  set.setFilter('actor', null);
                }}
              />
            )}
            {values.action !== null && (
              <FilterChip
                label={COPY.chips.action}
                value={auditActionLabel(values.action)}
                onClear={() => {
                  set.setFilter('action', null);
                }}
              />
            )}
            {values.target !== null && (
              <FilterChip
                label={COPY.chips.doneTo}
                value={nameOf(values.target)}
                onClear={() => {
                  set.setFilter('target', null);
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
              filterSummary={filterSummary}
              onClearFilters={clearFilters}
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
