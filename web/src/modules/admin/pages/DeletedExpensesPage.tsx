// SPEC-GAP: E4 DeletedExpensesPage. E4 Deleted Expenses, /admin/expenses/deleted (UI-SPEC "E4 Deleted Expenses"; D-03, D-04, D-07, OQ-2,
// OQ-5, WEB-10; plan 06-16). The Manager-only list of soft-deleted expenses, most recently deleted first: a back link, the `.s-ph`
// header with the "Manager only" badge, the toolbar (search and category, no dates), the result bar with one chip per filter, a
// ResponsiveTable of the server's rows, Pagination. A deleted expense counts nowhere, so there is no period total.
//   - The search, category, page and size live in the URL through useDeletedExpensesListParams and nowhere else; the query keys on
//     the parsed values after useSettledListParams (WEB-08, WEB-10).
//   - The route's loader sends an Admin back to /admin/expenses; the API answers 403 for a role lost mid-session, and the page then
//     shows the "You don't have access to this" banner instead of the table.
//   - Restore acts at once with no confirmation (OQ-5): the row leaves, focus moves to the next row's Restore (else the previous,
//     else the h1), and the lists, month figures and this list read again. A failure is a danger toast that stays until closed.
//     The POST keeps its Idempotency-Key through a retry and gets a new one for the next action (useExpenseAction).
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { useToast } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  loginBackClasses,
} from '@/components/layout/layout.recipe';
import { Money } from '@/components/money';
import {
  FilterBar,
  FilterChip,
  Pagination,
  ResponsiveTable,
  ResultBar,
  RowAction,
  RowActions,
  SearchBox,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { ExpenseActorCell } from '@/modules/admin/components/ExpenseActorCell';
import { ExpenseCategorySelect } from '@/modules/admin/components/ExpenseCategorySelect';
import {
  expensesBackRowClasses,
  expensesTitleRowClasses,
  expensesWrapClasses,
} from '@/modules/admin/components/expenses.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useDeletedExpensesListParams } from '@/modules/admin/hooks/useDeletedExpensesListParams';
import { useDeletedExpensesQuery } from '@/modules/admin/hooks/useDeletedExpensesQuery';
import { useExpenseAction } from '@/modules/admin/hooks/useExpenseAction';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { useRefreshExpenses } from '@/modules/admin/hooks/useRefreshExpenses';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { expensesService, type DeletedExpenseListItem } from '@/modules/admin/services/expensesService';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';
import { formatBusinessDateTime, formatCalendarDate } from '@/utils/format';

const COPY = EXPENSES_COPY.deleted;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'deleted-expenses-results';

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  restore: (expense: DeletedExpenseListItem) => void;
  /** Remembers each row's Restore button, so focus can move to a neighbour. */
  register: (id: string, button: HTMLButtonElement | null) => void;
}

function columnsFor(wiring: RowWiring): readonly ResponsiveTableColumn<DeletedExpenseListItem>[] {
  return [
    {
      key: 'deleted',
      header: COPY.columns.deleted,
      lead: true,
      cell: (item) => {
        const text = formatBusinessDateTime(item.deletedAt);
        return text === null ? null : <time dateTime={item.deletedAt}>{text}</time>;
      },
    },
    { key: 'date', header: COPY.columns.date, cell: (item) => formatCalendarDate(item.date) },
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
    { key: 'paidBy', header: COPY.columns.paidBy, cell: (item) => <ExpenseActorCell actor={item.paidBy} /> },
    { key: 'deletedBy', header: COPY.columns.deletedBy, cell: (item) => <ExpenseActorCell actor={item.deletedBy} /> },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const date = formatCalendarDate(item.date) ?? item.date;
        const restoreLabel = COPY.restore.label(item.description, date);
        return (
          <RowActions>
            <RowAction
              icon="rotate-ccw"
              label={restoreLabel}
              title={restoreLabel}
              onClick={() => {
                wiring.restore(item);
              }}
              ref={(button) => {
                wiring.register(item.id, button);
              }}
            />
          </RowActions>
        );
      },
    },
  ];
}

export function DeletedExpensesRoute() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const refreshAll = useRefreshExpenses();
  const rowFocus = useRowFocus();
  // Where focus goes once the restored row has left the list.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  const [values, set] = useDeletedExpensesListParams();
  const settled = useSettledListParams(values, 300);
  const query = useDeletedExpensesQuery({
    q: settled.q,
    category: settled.category,
    page: settled.page,
    pageSize: settled.size,
  });
  const categories = useExpenseCategoriesQuery();

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  const total = toNumber(data?.total ?? 0);
  const pageCount = Math.ceil(total / values.size);

  // A page past the last one (a stale link, or rows restored meanwhile) becomes the last page, once fresh data says so.
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
        (categories.isPending ? EXPENSES_COPY.category.loading : EXPENSES_COPY.category.unknown));

  // Focus lands on the Restore button of the next row, else the previous one, else the h1.
  const chooseFocusAfter = (expense: DeletedExpenseListItem): string | null => {
    const items = data?.items ?? [];
    const index = items.findIndex((item) => item.id === expense.id);
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const restoration = useExpenseAction<DeletedExpenseListItem>(
    (key, expense) => expensesService.restore(expense.id, key),
    (expense) => {
      afterRemoval.current = { removedId: expense.id, focusId: chooseFocusAfter(expense) };
      toast.show({
        title: COPY.restore.toast.title,
        message: COPY.restore.toast.message(expense.description),
      });
      return refreshAll();
    },
  );

  // Once the list no longer holds the restored row, move focus.
  useEffect(() => {
    const wanted = afterRemoval.current;
    if (wanted === null || data === undefined || data.items.some((item) => item.id === wanted.removedId)) {
      return;
    }
    afterRemoval.current = null;
    if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
      headingRef.current?.focus();
    }
  });

  // Restore is reversible, so it acts at once; a failure is a danger toast that stays until closed.
  const restore = async (expense: DeletedExpenseListItem): Promise<void> => {
    const outcome = await restoration.submit(expense);
    if (!outcome.ok) {
      const copy = describeHttpError(outcome.error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: COPY.restore.failed(expense.description), message: errorLine(copy) });
      }
    }
  };

  const wiring: RowWiring = {
    restore: (expense) => {
      void restore(expense);
    },
    register: rowFocus.register,
  };

  const forbidden = isHttpError(query.error) && query.error.status === 403;
  const denied = forbidden ? describeHttpError(query.error) : null;
  const filtered = values.category !== null;

  return (
    <>
      <div className={expensesBackRowClasses}>
        <UiLink to="/admin/expenses" className={clsx(loginBackClasses, hitAreaClasses)}>
          <Icon name="chevron-left" size={16} />
          {COPY.back}
        </UiLink>
      </div>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={expensesTitleRowClasses}>
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
            <SearchBox
              value={values.q}
              label={EXPENSES_COPY.search.label}
              placeholder={EXPENSES_COPY.search.placeholder}
              onSearch={set.setSearch}
            />
            <ExpenseCategorySelect
              mode="filter"
              value={values.category}
              onChange={(id) => {
                set.setFilter('category', id);
              }}
            />
          </FilterBar>
          <ResultBar count={total} thing={COPY.thing} things={COPY.things} orderNote={COPY.orderNote}>
            {values.q !== null && (
              <FilterChip
                label={EXPENSES_COPY.search.label}
                value={values.q}
                onClear={() => {
                  set.setSearch('', { immediate: true });
                }}
              />
            )}
            {categoryName !== null && (
              <FilterChip
                label={EXPENSES_COPY.category.label}
                value={categoryName}
                onClear={() => {
                  set.setFilter('category', null);
                }}
              />
            )}
          </ResultBar>
          <ResponsiveTable<DeletedExpenseListItem>
            caption={COPY.tableCaption}
            columns={columnsFor(wiring)}
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
            filtered={filtered}
            search={values.q}
            filterSummary={EXPENSES_COPY.filterSummary(categoryName, null)}
            onClearFilters={() => {
              set.setSearch('', { immediate: true });
              set.setFilter('category', null);
            }}
            emptyIcon="archive"
            emptyTitle={COPY.empty.title}
            emptyMessage={COPY.empty.message}
          />
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
