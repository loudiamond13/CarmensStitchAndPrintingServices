// X1 Deleted Orders, /admin/orders/deleted (ORD-06, D-23, D-52; plan 08-20). The Manager-only list of soft-deleted orders, most
// recently deleted first: a back link, the header with the "Manager only" badge, the result bar, a ResponsiveTable of the server's
// rows and Pagination. It pages and does not search (D-52). A deleted order counts nowhere, so there is no total row.
//   - The page and size live in the URL through useDeletedOrdersListParams and nowhere else.
//   - The route's loader sends an Admin back to /admin/orders; the API answers 403 for a role lost mid-session, and the page then
//     shows the "You don't have access to this" banner instead of the table.
//   - Restore acts at once with no confirmation (D-23): the row leaves, focus moves to the next row's Restore (else the previous,
//     else the h1), and the order lists and this list read again. A failure is a danger toast that stays until closed. The POST keeps
//     its Idempotency-Key through a retry and gets a new one for the next action (useOrderAction).
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { useToast } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import {
  CustomerCell,
  Pagination,
  ResponsiveTable,
  ResultBar,
  RowAction,
  RowActions,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { Money } from '@/components/money';
import { ErrorState } from '@/components/states';
import { Badge, StatusBadge, isOrderStatus } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { ExpenseActorCell } from '@/modules/admin/components/ExpenseActorCell';
import { expensesBackRowClasses, expensesTitleRowClasses } from '@/modules/admin/components/expenses.recipe';
import { ordersNumberLinkClasses } from '@/modules/admin/components/orders.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { DELETED_ORDERS_COPY } from '@/modules/admin/deletedOrdersCopy';
import { useDeletedOrdersListParams } from '@/modules/admin/hooks/useDeletedOrdersListParams';
import { useDeletedOrdersQuery } from '@/modules/admin/hooks/useDeletedOrdersQuery';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { deletedOrdersService, type DeletedOrderListItem } from '@/modules/admin/services/deletedOrdersService';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';
import { formatBusinessDateTime } from '@/utils/format';

const COPY = DELETED_ORDERS_COPY;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'deleted-orders-results';

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  view: (order: DeletedOrderListItem) => void;
  restore: (order: DeletedOrderListItem) => void;
  /** Remembers each row's Restore button, so focus can move to a neighbour. */
  register: (id: string, button: HTMLButtonElement | null) => void;
}

function columnsFor(wiring: RowWiring): readonly ResponsiveTableColumn<DeletedOrderListItem>[] {
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
    {
      key: 'order',
      header: COPY.columns.order,
      cell: (item) => (
        <UiLink to={`/admin/orders/deleted/${item.id}`} className={ordersNumberLinkClasses}>
          {item.number}
        </UiLink>
      ),
    },
    {
      key: 'customer',
      header: COPY.columns.customer,
      cell: (item) => <CustomerCell team={item.teamName} customer={item.customerName} />,
    },
    {
      key: 'status',
      header: COPY.columns.status,
      cell: (item) => (isOrderStatus(item.status) ? <StatusBadge status={item.status} /> : item.status),
    },
    { key: 'total', header: COPY.columns.total, money: true, cell: (item) => <Money amount={toNumber(item.total)} /> },
    { key: 'paid', header: COPY.columns.paid, money: true, cell: (item) => <Money amount={toNumber(item.paid)} /> },
    {
      key: 'balance',
      header: COPY.columns.balance,
      money: true,
      cell: (item) => <Money amount={toNumber(item.balance)} />,
    },
    {
      key: 'deletedBy',
      header: COPY.columns.deletedBy,
      cell: (item) => <ExpenseActorCell actor={item.deletedBy} />,
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const view = COPY.view(item.number);
        const restore = COPY.restore.label(item.number);
        return (
          <RowActions>
            <RowAction
              icon="eye"
              label={view}
              title={view}
              onClick={() => {
                wiring.view(item);
              }}
            />
            <RowAction
              icon="rotate-ccw"
              label={restore}
              title={restore}
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

export default function DeletedOrdersPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const refreshAll = useRefreshOrders();
  const rowFocus = useRowFocus();
  // Where focus goes once the restored row has left the list.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  const [values, set] = useDeletedOrdersListParams();
  const query = useDeletedOrdersQuery({ page: values.page, pageSize: values.size });

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

  // Focus lands on the Restore button of the next row, else the previous one, else the h1.
  const chooseFocusAfter = (order: { id: string }): string | null => {
    const items = data?.items ?? [];
    const index = items.findIndex((item) => item.id === order.id);
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const restoration = useOrderAction(
    (key, order: DeletedOrderListItem) => deletedOrdersService.restore(order.id, key),
    (_result, order) => {
      afterRemoval.current = { removedId: order.id, focusId: chooseFocusAfter(order) };
      toast.show({
        title: COPY.restore.toast.title,
        message: COPY.restore.toast.message(order.number),
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

  // Restore is reversible, so it acts at once; a failure is a danger toast that stays until closed. A 404 means the order was
  // deleted for good meanwhile, so the lists read again.
  const restore = async (order: DeletedOrderListItem): Promise<void> => {
    const outcome = await restoration.submit(order);
    if (!outcome.ok) {
      if (isHttpError(outcome.error) && outcome.error.status === 404) {
        void refreshAll();
      }
      const copy = describeHttpError(outcome.error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: COPY.restore.failed(order.number), message: errorLine(copy) });
      }
    }
  };

  const wiring: RowWiring = {
    view: (order) => {
      void navigate(`/admin/orders/deleted/${order.id}`);
    },
    restore: (order) => {
      void restore(order);
    },
    register: rowFocus.register,
  };

  const forbidden = isHttpError(query.error) && query.error.status === 403;
  const denied = forbidden ? describeHttpError(query.error) : null;

  return (
    <>
      <div className={expensesBackRowClasses}>
        <UiLink to="/admin/orders" className={clsx(loginBackClasses, hitAreaClasses)}>
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
          <ResultBar count={total} thing={COPY.thing} things={COPY.things} orderNote={COPY.orderNote} />
          <ResponsiveTable<DeletedOrderListItem>
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
