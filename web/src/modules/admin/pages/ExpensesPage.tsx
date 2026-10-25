// E1 Company Expenses, /admin/expenses (UI-SPEC "E1 Company Expenses"; App. E.11; CEXP-01, CEXP-04, CEXP-05, D-23, D-25,
// WEB-10; plan 06-04). Both roles see the same list: the `.s-ph` header, the result bar, a ResponsiveTable of the server's
// rows with Paid by and Recorded by, Pagination with Rows per page and the caption.
//   - The page and size live in the URL through useExpensesListParams and nowhere else; the query keys on the parsed
//     values after useSettledListParams (WEB-08, WEB-10).
//   - The browser adds nothing: the count, the period total (every page of the filter), the window and the business today
//     all come from the answer (Core Value, D-23). Filters, KPIs and the row actions arrive in later plans.
import { useEffect, useRef } from 'react';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { Money } from '@/components/money';
import {
  FilterBar,
  FilterChip,
  Pagination,
  ResponsiveTable,
  ResultBar,
  SearchBox,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { EmptyValue } from '@/components/states';
import { Avatar, Badge } from '@/components/status';
import { ActorName } from '@/components/data';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import {
  expensesActorClasses,
  expensesAvatarClasses,
  expensesCaptionClasses,
  expensesDateCellClasses,
  expensesDateClasses,
  expensesWrapClasses,
} from '@/modules/admin/components/expenses.recipe';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { ExpenseCategorySelect } from '@/modules/admin/components/ExpenseCategorySelect';
import { ExpensesDateRange } from '@/modules/admin/components/ExpensesDateRange';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { useExpensesListParams } from '@/modules/admin/hooks/useExpensesListParams';
import { useExpensesQuery } from '@/modules/admin/hooks/useExpensesQuery';
import type { ActorRef, ExpenseListItem } from '@/modules/admin/services/expensesService';
import { formatCalendarDate } from '@/utils/format';

const COPY = EXPENSES_COPY;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'expenses-results';

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

/** Avatar 24 (decorative: the name is the text) and the name; no avatar for System. */
function ActorCell({ actor }: { actor: ActorRef | null }) {
  return (
    <span className={expensesActorClasses}>
      {actor !== null && (
        <span aria-hidden="true" className={expensesAvatarClasses}>
          <Avatar name={actor.name} size={24} />
        </span>
      )}
      <span className={expensesWrapClasses}>
        <ActorName actor={actor} />
      </span>
    </span>
  );
}

/** The columns. An expense dated after `today` (the server's business today, never the device clock, D-23) is Upcoming. */
function columnsFor(today: string): readonly ResponsiveTableColumn<ExpenseListItem>[] {
  return [
    {
      key: 'date',
      header: COPY.columns.date,
      lead: true,
      cell: (item) => (
        <span className={expensesDateCellClasses}>
          <strong className={expensesDateClasses}>{formatCalendarDate(item.date) ?? <EmptyValue />}</strong>
          {item.date > today && (
            <Badge tone="info" icon="clock">
              {COPY.upcoming}
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'category', header: COPY.columns.category, cell: (item) => <CategoryBadge category={item.category} /> },
    {
      key: 'description',
      header: COPY.columns.description,
      cell: (item) => <span className={expensesWrapClasses}>{item.description}</span>,
    },
    {
      key: 'amount',
      header: COPY.columns.amount,
      money: true,
      cell: (item) => <Money amount={toNumber(item.amount)} />,
    },
    { key: 'paidBy', header: COPY.columns.paidBy, cell: (item) => <ActorCell actor={item.paidBy} /> },
    { key: 'recordedBy', header: COPY.columns.recordedBy, cell: (item) => <ActorCell actor={item.recordedBy} /> },
  ];
}

export function ExpensesRoute() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [values, set] = useExpensesListParams();
  const settled = useSettledListParams(values, 300);
  const query = useExpensesQuery({
    q: settled.q,
    category: settled.category,
    from: settled.from,
    to: settled.to,
    page: settled.page,
    pageSize: settled.size,
  });
  const categories = useExpenseCategoriesQuery();

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  const hasRows = data !== undefined && data.items.length > 0;
  const total = toNumber(data?.total ?? 0);
  const pageCount = Math.ceil(total / values.size);

  // A page past the last one (a stale link, or rows deleted meanwhile) becomes the last page, once fresh data says so.
  const { clampPage } = set;
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  // A category id the list does not hold (a stale or shared link) becomes All categories, once the list has loaded (D-11).
  const { setFilter } = set;
  const knownCategories = categories.data;
  const unknownCategory =
    knownCategories !== undefined &&
    values.category !== null &&
    !knownCategories.some((category) => category.id.toLowerCase() === values.category);
  useEffect(() => {
    if (unknownCategory) {
      setFilter('category', null);
    }
  }, [unknownCategory, setFilter]);

  const categoryName =
    values.category === null
      ? null
      : (knownCategories?.find((category) => category.id.toLowerCase() === values.category)?.name ??
        (categories.isPending ? COPY.category.loading : COPY.category.unknown));
  // The chip and the inputs show the pair in the URL, else the window the server used (never the device clock, D-23).
  const customFrom = values.from === null ? null : formatCalendarDate(values.from);
  const customTo = values.to === null ? null : formatCalendarDate(values.to);

  const from = data === undefined ? null : formatCalendarDate(data.from);
  const to = data === undefined ? null : formatCalendarDate(data.to);
  const footer =
    data === undefined
      ? undefined
      : {
          date: from !== null && to !== null ? COPY.footer.summary(total, COPY.thing, COPY.things, from, to) : null,
          amount: <Money amount={toNumber(data.periodTotal)} />,
        };

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 id={HEADING_ID} ref={headingRef} tabIndex={-1} className={pageTitleClasses}>
            {COPY.title}
          </h1>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <FilterBar>
        <SearchBox
          value={values.q}
          label={COPY.search.label}
          placeholder={COPY.search.placeholder}
          onSearch={set.setSearch}
        />
        <ExpenseCategorySelect
          mode="filter"
          value={values.category}
          onChange={(id) => {
            set.setFilter('category', id);
          }}
        />
        <ExpensesDateRange
          from={values.from ?? data?.from ?? ''}
          to={values.to ?? data?.to ?? ''}
          onApply={(start, end) => {
            set.setFilters({ from: start, to: end });
          }}
        />
      </FilterBar>
      <ResultBar count={total} thing={COPY.thing} things={COPY.things} orderNote={COPY.orderNote}>
        {values.q !== null && (
          <FilterChip
            label={COPY.search.label}
            value={values.q}
            onClear={() => {
              set.setSearch('', { immediate: true });
            }}
          />
        )}
        {categoryName !== null && (
          <FilterChip
            label={COPY.category.label}
            value={categoryName}
            onClear={() => {
              set.setFilter('category', null);
            }}
          />
        )}
        {customFrom !== null && customTo !== null && (
          <FilterChip
            label={COPY.dates.chip}
            value={COPY.dates.range(customFrom, customTo)}
            onClear={() => {
              set.setFilters({ from: null, to: null });
            }}
          />
        )}
      </ResultBar>
      <ResponsiveTable<ExpenseListItem>
        caption={COPY.tableCaption}
        columns={columnsFor(data?.today ?? '')}
        rows={data?.items}
        rowKey={(item) => item.id}
        things={COPY.things}
        pending={query.isPending}
        refetching={query.isPlaceholderData && query.isFetching}
        failed={query.isError}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
        // SPEC-DEVIATION: OQ-13 the footer's phone label reads "Total": the figure covers every page, not the rows shown.
        footer={footer}
        emptyIcon="receipt"
        emptyTitle={COPY.empty.title}
        emptyMessage={from !== null && to !== null ? COPY.empty.message(from, to) : undefined}
        footerLayout={{ date: { span: 3 }, amount: { label: COPY.footer.totalLabel } }}
      />
      {hasRows && <p className={expensesCaptionClasses}>{COPY.caption}</p>}
      <Pagination
        page={values.page}
        pageCount={pageCount}
        onPageChange={set.setPage}
        focusTargetId={HEADING_ID}
        pageSize={values.size}
        onPageSizeChange={set.setPageSize}
      />
    </>
  );
}
