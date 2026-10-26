// E1 Company Expenses, /admin/expenses. Both roles see the KPI row, the toolbar, the result bar with its filter chips, the
// table with the period total, and pagination. Search, filters, page and size live in the URL; every figure (counts, totals,
// the window, today) comes from the server. A Manager also gets Delete.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
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
  RowAction,
  RowActions,
  SearchBox,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { EmptyValue } from '@/components/states';
import { Badge } from '@/components/status';
import { formatPeso } from '@/utils/csps';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import {
  expensesCaptionClasses,
  expensesDateCellClasses,
  expensesDateClasses,
  expensesHeadActionsClasses,
  expensesWrapClasses,
} from '@/modules/admin/components/expenses.recipe';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { ExpenseActorCell } from '@/modules/admin/components/ExpenseActorCell';
import { ExpenseCategorySelect } from '@/modules/admin/components/ExpenseCategorySelect';
import { ExpenseKpiRow } from '@/modules/admin/components/ExpenseKpiRow';
import { ExpenseModal } from '@/modules/admin/components/ExpenseModal';
import { PurgeExpenseDialog } from '@/modules/admin/components/PurgeExpenseDialog';
import { ExpensesDateRange } from '@/modules/admin/components/ExpensesDateRange';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { useExpenseAction } from '@/modules/admin/hooks/useExpenseAction';
import { useRefreshExpenses } from '@/modules/admin/hooks/useRefreshExpenses';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useExpensesListParams } from '@/modules/admin/hooks/useExpensesListParams';
import { useExpenseKpisQuery } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expensesKey, useExpensesQuery } from '@/modules/admin/hooks/useExpensesQuery';
import {
  expensesService,
  type ExpenseDetailResponse,
  type ExpenseListItem,
  type ExpenseListResponse,
} from '@/modules/admin/services/expensesService';
import { formatCalendarDate } from '@/utils/format';

const COPY = EXPENSES_COPY;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'expenses-results';
/** The table's visually hidden caption: where focus lands when a saved row has left the view. */
const CAPTION_ID = 'expenses-table-caption';

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

interface ActiveFilters {
  q: string | null;
  category: string | null;
  from: string | null;
  to: string | null;
}

/**
 * True when a new expense would not be listed under the current search, category and dates: the search looks in the
 * description and the payer's and recorder's names, the category must be the chosen one, and the date must sit in the range in
 * the URL, else in the window the server used (D-23). The browser only decides what to say; the server's list is the truth.
 */
function isOutsideFilters(
  expense: ExpenseDetailResponse,
  filters: ActiveFilters,
  window: { from: string; to: string } | null,
): boolean {
  const search = filters.q?.trim().toLowerCase() ?? '';
  if (search !== '') {
    const places = [expense.description, expense.paidBy.name, expense.recordedBy?.name ?? ''];
    if (!places.some((text) => text.toLowerCase().includes(search))) {
      return true;
    }
  }
  if (filters.category !== null && expense.category.id.toLowerCase() !== filters.category) {
    return true;
  }
  const from = filters.from ?? window?.from;
  const to = filters.to ?? window?.to;
  return (from !== undefined && expense.date < from) || (to !== undefined && expense.date > to);
}

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  edit: (expense: ExpenseListItem) => void;
  view: (expense: ExpenseListItem) => void;
  /** Opens the delete confirmation. Only a Manager gets the action (D-02). */
  remove: (expense: ExpenseListItem) => void;
  /** Opens the permanent-delete warning (OQ-1). */
  purge: (expense: ExpenseListItem) => void;
  canDelete: boolean;
  /** Remembers each row's action button, so focus can return to it. */
  register: (id: string, button: HTMLButtonElement | null) => void;
}

/** The columns. An expense dated after `today` (the server's business today, never the device clock, D-23) is Upcoming. */
function columnsFor(today: string, wiring: RowWiring): readonly ResponsiveTableColumn<ExpenseListItem>[] {
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
    { key: 'paidBy', header: COPY.columns.paidBy, cell: (item) => <ExpenseActorCell actor={item.paidBy} /> },
    {
      key: 'recordedBy',
      header: COPY.columns.recordedBy,
      cell: (item) => <ExpenseActorCell actor={item.recordedBy} />,
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const date = formatCalendarDate(item.date) ?? item.date;
        // SPEC-DEVIATION: D-26 Edit only where the server says the caller may edit (a Manager always may); the others get View.
        // SPEC-GAP: OQ-8 View opens the expense read-only.
        const editable = item.canEdit;
        const label = editable
          ? COPY.rowActions.edit(item.description, date)
          : COPY.rowActions.view(item.description, date);
        const deleteLabel = COPY.remove.rowDelete(item.description, date);
        const purgeLabel = COPY.purge.rowLabel(item.description, date);
        return (
          <RowActions>
            <RowAction
              icon={editable ? 'pencil' : 'eye'}
              label={label}
              title={label}
              onClick={() => {
                if (editable) {
                  wiring.edit(item);
                } else {
                  wiring.view(item);
                }
              }}
              ref={(button) => {
                wiring.register(item.id, button);
              }}
            />
            {/* SPEC-DEVIATION: D-01 / D-02 App. E.11 gave every row Delete; here only a Manager gets it, and it is a soft delete. */}
            {wiring.canDelete && (
              <RowAction
                icon="trash-2"
                label={deleteLabel}
                title={deleteLabel}
                danger
                onClick={() => {
                  wiring.remove(item);
                }}
              />
            )}
            {/* SPEC-DEVIATION: OQ-1 App. E.11 has two row icons; a Manager gets a third, the eraser, for Delete permanently (D-04). */}
            {wiring.canDelete && (
              <RowAction
                icon="eraser"
                label={purgeLabel}
                title={purgeLabel}
                danger
                onClick={() => {
                  wiring.purge(item);
                }}
              />
            )}
          </RowActions>
        );
      },
    },
  ];
}

export function ExpensesRoute() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  // The expense whose Edit modal is open or was last open (kept while it animates out), and each row's action button.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // The same for the read-only View of an expense the caller cannot edit.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const rowFocus = useRowFocus();
  // Every expense change reads the lists, the month figures, the deleted list and the categories again (UI-SPEC Freshness).
  const refreshAll = useRefreshExpenses();
  const { user: me } = useSession();
  const isManager = me?.role === 'manager';
  // The expense the Delete confirm is open for, or was last open for (kept while it animates out), and where focus goes once
  // the deleted row has left the list.
  const [deleting, setDeleting] = useState<{ expense: ExpenseListItem; open: boolean } | null>(null);
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  // The same for the Delete permanently warning.
  const [purging, setPurging] = useState<{ expense: ExpenseListItem; open: boolean } | null>(null);
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
  const kpis = useExpenseKpisQuery();

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

  const customDates = customFrom !== null && customTo !== null ? COPY.dates.range(customFrom, customTo) : null;
  const filtered = values.category !== null || customDates !== null;

  const from = data === undefined ? null : formatCalendarDate(data.from);
  const to = data === undefined ? null : formatCalendarDate(data.to);
  const footer =
    data === undefined
      ? undefined
      : {
          date: from !== null && to !== null ? COPY.footer.summary(total, COPY.thing, COPY.things, from, to) : null,
          amount: <Money amount={toNumber(data.periodTotal)} />,
        };

  // The server's business today, never the device clock (D-23): from the list, else from the month figures.
  const today = data?.today ?? kpis.data?.today ?? null;

  // The lists and the month figures read again so the new expense counts at once (UI-SPEC Freshness).
  const openAdd = (): void => {
    if (today !== null) {
      setAdding(true);
    }
  };

  const saved = (expense: ExpenseDetailResponse): void => {
    const outside = isOutsideFilters(
      expense,
      { q: values.q, category: values.category, from: values.from, to: values.to },
      data === undefined ? null : { from: data.from, to: data.to },
    );
    toast.show({
      tone: 'success',
      title: COPY.add.toast.title,
      message:
        COPY.add.toast.message(formatPeso(expense.amount), expense.category.name) +
        (outside ? COPY.add.toast.outsideFilters : ''),
    });
    void refreshAll().then(() => {
      // A trigger that left the page with the list (the first-use action) cannot take focus back: the header button does.
      if (document.activeElement === null || document.activeElement === document.body) {
        addRef.current?.focus();
      }
    });
  };

  // The same reads as an add; then focus returns to the saved row's button, or to the caption when the row left the view.
  const updated = (expense: ExpenseDetailResponse): void => {
    toast.show({
      tone: 'success',
      title: COPY.edit.toast.title,
      message: COPY.add.toast.message(formatPeso(expense.amount), expense.category.name),
    });
    void refreshAll().then(() => {
      // The answer is in the cache before the table redraws, so ask it (not the DOM) whether the row is still listed.
      const listed = queryClient
        .getQueriesData<ExpenseListResponse>({ queryKey: expensesKey, type: 'active' })
        .some(([, answer]) => answer?.items.some((item) => item.id === expense.id) === true);
      if (!listed || !rowFocus.focusRow(expense.id)) {
        document.getElementById(CAPTION_ID)?.focus();
      }
    });
  };

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  // Focus lands on the first action of the next row, else the previous one, else the h1 (UI-SPEC Interaction Contract).
  const chooseFocusAfter = (expense: { id: string }): string | null => {
    const items = data?.items ?? [];
    const index = items.findIndex((item) => item.id === expense.id);
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const removal = useExpenseAction<ExpenseListItem>(
    (_key, expense) => expensesService.remove(expense.id),
    (expense) => {
      afterRemoval.current = { removedId: expense.id, focusId: chooseFocusAfter(expense) };
      closeDelete();
      toast.show({ title: COPY.remove.toast.title, message: COPY.remove.toast.message(expense.description) });
      return refreshAll();
    },
  );

  // A failure stays in the dialog as the mapper line; a 404 means someone else got there first, so the dialog closes and the list
  // is read again.
  const confirmRemoval = async (expense: ExpenseListItem) => {
    const outcome = await removal.submit(expense);
    if (!outcome.ok && isHttpError(outcome.error) && outcome.error.status === 404) {
      afterRemoval.current = { removedId: expense.id, focusId: chooseFocusAfter(expense) };
      closeDelete();
      toast.show({ tone: 'info', title: COPY.alreadyGone.title, message: COPY.alreadyGone.message });
      void refreshAll();
      return undefined;
    }
    return outcome;
  };

  // Once the list no longer holds the deleted row, move focus (the dialog's own return to the gone button has run).
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

  const closePurge = (): void => {
    setPurging((current) => (current === null ? null : { ...current, open: false }));
  };

  const wiring: RowWiring = {
    edit: (expense) => {
      if (today !== null) {
        setEditingId(expense.id);
        setEditing(true);
      }
    },
    view: (expense) => {
      setViewingId(expense.id);
      setViewing(true);
    },
    remove: (expense) => {
      setDeleting({ expense, open: true });
    },
    purge: (expense) => {
      setPurging({ expense, open: true });
    },
    canDelete: isManager,
    register: rowFocus.register,
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
        <div className={expensesHeadActionsClasses}>
          {/* SPEC-GAP: OQ-2 the Manager's way to the deleted expenses, before the one primary action. */}
          {isManager && (
            <ButtonLink variant="secondary" to="/admin/expenses/deleted">
              {COPY.deletedLink}
            </ButtonLink>
          )}
          <Button variant="primary" icon="plus" ref={addRef} aria-disabled={today === null} onClick={openAdd}>
            {COPY.add.open}
          </Button>
        </div>
      </div>
      {today !== null && (
        <ExpenseModal
          mode="add"
          open={adding}
          today={today}
          onClose={() => {
            setAdding(false);
          }}
          onSaved={saved}
        />
      )}
      {today !== null && (
        <ExpenseModal
          mode="edit"
          open={editing}
          expenseId={editingId}
          today={today}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={updated}
        />
      )}
      <ExpenseModal
        mode="view"
        open={viewing}
        expenseId={viewingId}
        onClose={() => {
          setViewing(false);
        }}
      />
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={COPY.remove.title(deleting.expense.description, formatPeso(deleting.expense.amount))}
          message={COPY.remove.message}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          onConfirm={() => confirmRemoval(deleting.expense)}
          onCancel={closeDelete}
        />
      )}
      {purging !== null && (
        <PurgeExpenseDialog
          expense={purging.expense}
          open={purging.open}
          onClose={closePurge}
          onRemoved={(expense) => {
            afterRemoval.current = { removedId: expense.id, focusId: chooseFocusAfter(expense) };
          }}
        />
      )}
      <ExpenseKpiRow />
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
        {customDates !== null && (
          <FilterChip
            label={COPY.dates.chip}
            value={customDates}
            onClear={() => {
              set.setFilters({ from: null, to: null });
            }}
          />
        )}
      </ResultBar>
      <ResponsiveTable<ExpenseListItem>
        caption={COPY.tableCaption}
        captionId={CAPTION_ID}
        columns={columnsFor(data?.today ?? '', wiring)}
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
        filterSummary={COPY.filterSummary(categoryName, customDates)}
        onClearFilters={() => {
          set.setSearch('', { immediate: true });
          set.setFilters({ category: null, from: null, to: null });
        }}
        // SPEC-DEVIATION: OQ-13 the footer's phone label reads "Total": the figure covers every page, not the rows shown.
        footer={footer}
        emptyIcon="receipt"
        emptyTitle={COPY.empty.title}
        emptyMessage={from !== null && to !== null ? COPY.empty.message(from, to) : undefined}
        emptyAction={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            {COPY.add.open}
          </Button>
        }
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
