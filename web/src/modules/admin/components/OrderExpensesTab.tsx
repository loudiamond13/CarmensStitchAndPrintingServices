// The Expenses tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-12, D-15, D-54a; plans 08-12, 08-18): internal costs of the order with
// who paid and who recorded each one, and an Order expenses footer from the server's figure. Staff only: the customer never sees it.
// On an active order the head has Add Expense and each row has Edit and Delete; a locked order, and the deleted view (`readOnly`), show
// the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderExpenseModal } from '@/modules/admin/components/OrderExpenseModal';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { orderSavedMessage } from '@/modules/admin/hooks/useOrderChildSave';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { ORDER_EXPENSE_COPY } from '@/modules/admin/orderExpenseCopy';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderExpensesService } from '@/modules/admin/services/orderExpensesService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';
import { formatCalendarDate } from '@/utils/format';

type OrderExpense = OrderDetailResponse['expenses'][number];

const COPY = ORDER_PAGE_COPY.expenses;
const EXPENSE = ORDER_EXPENSE_COPY;

/** The columns every view shows; an editable view adds the actions column after them. */
const COLUMNS: readonly ResponsiveTableColumn<OrderExpense>[] = [
  {
    key: 'date',
    header: COPY.columns.date,
    lead: true,
    cell: (expense) => <OrderDateCell date={expense.expenseDate} />,
  },
  { key: 'category', header: COPY.columns.category, cell: (expense) => <CategoryBadge category={expense.category} /> },
  { key: 'description', header: COPY.columns.description, cell: (expense) => expense.description },
  { key: 'paidBy', header: COPY.columns.paidBy, cell: (expense) => <OrderPersonCell person={expense.paidBy} /> },
  {
    key: 'recordedBy',
    header: COPY.columns.recordedBy,
    cell: (expense) => <OrderPersonCell person={expense.recordedBy} />,
  },
  { key: 'amount', header: COPY.columns.amount, money: true, cell: (expense) => formatPeso(expense.amount) },
];

/** The focus registry key of a row's Delete button (the Edit button is registered under the plain id). */
const deleteKey = (id: string): string => `delete:${id}`;

/** The row's date as the row action names print it ("Oct 3, 2026"). */
const dateOf = (expense: OrderExpense): string => formatCalendarDate(expense.expenseDate) ?? expense.expenseDate;

export interface OrderExpensesTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). */
  readOnly?: boolean | undefined;
}

interface ExpensesViewProps {
  order: OrderDetailResponse;
  columns: readonly ResponsiveTableColumn<OrderExpense>[];
  /** The Add Expense button. */
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What follows the table: the windows. */
  children?: ReactNode;
}

/** The head and the table. Windows render after it, never inside the table frame (a fixed layer cannot live there). */
function ExpensesView({ order, columns, action, headingRef, children }: ExpensesViewProps) {
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} action={action} headingRef={headingRef} />
      <div className={orderTabBodyClasses}>
        {order.expenses.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={columns}
            rows={order.expenses}
            rowKey={(expense) => expense.id}
            things={COPY.things}
            footer={{ date: COPY.footerLabel, amount: formatPeso(order.totals.expenses) }}
            footerLayout={{
              date: { span: COLUMNS.length - 1 },
              amount: { label: COPY.footerAmountLabel },
            }}
          />
        )}
        {children}
      </div>
    </>
  );
}

/** The dialog's own failure line: the server's sentence for a refusal, and "removed" for an expense that is already gone. */
function describeDeleteFailure(error: unknown): ErrorCopy | string | undefined {
  if (!isHttpError(error) || error.kind !== 'http') {
    return undefined;
  }
  if (error.status === 422) {
    return error.problem?.detail;
  }
  return error.status === 404 ? EXPENSE.deleteGone : undefined;
}

/** An active order: Add Expense in the head, and each row's Edit and Delete. */
function EditableExpenses({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderExpenseModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ expenseId: string; open: boolean } | null>(null);
  // The expense the Delete dialog is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ expense: OrderExpense; open: boolean } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowFocus = useRowFocus();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);
  // Once the answer no longer holds the deleted row, focus goes to the next row's Edit, else the previous one, else the heading.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen && editing?.open !== true && deleting?.open !== true) {
      returnFocus.current = null;
      go();
    }
    const wanted = afterRemoval.current;
    if (wanted !== null && !order.expenses.some((expense) => expense.id === wanted.removedId)) {
      afterRemoval.current = null;
      if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
        headingRef.current?.focus();
      }
    }
  });

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useOrderAction<OrderExpense>(
    (_key, expense) => orderExpensesService.remove(order.id, expense.id),
    (answer, expense) => {
      const index = order.expenses.findIndex((candidate) => candidate.id === expense.id);
      afterRemoval.current = {
        removedId: expense.id,
        focusId: order.expenses[index + 1]?.id ?? order.expenses[index - 1]?.id ?? null,
      };
      closeDelete();
      toast.show({ tone: 'success', ...orderSavedMessage(answer, 'expense', 'deleted') });
      applyOrder(answer);
    },
    (error) => {
      // The page is out of date as well as refused (the expense is gone): read the order again.
      if (isHttpError(error) && (error.status === 404 || error.status === 422)) {
        void refetchOrder(order.id);
      }
    },
  );

  const columns: readonly ResponsiveTableColumn<OrderExpense>[] = [
    ...COLUMNS,
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (expense) => {
        const editName = EXPENSE.editAction(expense.amount, dateOf(expense));
        const deleteName = EXPENSE.deleteAction(expense.amount, dateOf(expense));
        return (
          <RowActions>
            <RowAction
              icon="pencil"
              label={editName}
              title={editName}
              ref={(button) => {
                rowFocus.register(expense.id, button);
              }}
              onClick={() => {
                setEditing({ expenseId: expense.id, open: true });
              }}
            />
            <RowAction
              icon="trash-2"
              label={deleteName}
              title={deleteName}
              danger
              ref={(button) => {
                rowFocus.register(deleteKey(expense.id), button);
              }}
              onClick={() => {
                setDeleting({ expense, open: true });
              }}
            />
          </RowActions>
        );
      },
    },
  ];

  return (
    <ExpensesView
      order={order}
      columns={columns}
      headingRef={headingRef}
      action={
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          ref={addRef}
          onClick={() => {
            setAddUsed(true);
            setAddOpen(true);
          }}
        >
          {EXPENSE.add}
        </Button>
      }
    >
      {addUsed && (
        <OrderExpenseModal
          mode="add"
          order={order}
          open={addOpen}
          onClose={() => {
            returnFocus.current = () => {
              addRef.current?.focus();
            };
            setAddOpen(false);
          }}
        />
      )}
      {editing !== null && (
        <OrderExpenseModal
          mode="edit"
          order={order}
          expenseId={editing.expenseId}
          open={editing.open}
          onClose={() => {
            const expenseId = editing.expenseId;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(expenseId)) {
                headingRef.current?.focus();
              }
            };
            setEditing({ expenseId, open: false });
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={EXPENSE.deleteTitle(deleting.expense.amount)}
          message={ORDER_WINDOWS_COPY.remove.message(order.number)}
          confirmLabel={EXPENSE.deleteConfirm}
          pendingLabel={ORDER_WINDOWS_COPY.remove.pending}
          cancelLabel={ORDER_WINDOWS_COPY.remove.cancel}
          describeFailure={describeDeleteFailure}
          onConfirm={() => removal.submit(deleting.expense)}
          onCancel={() => {
            const expenseId = deleting.expense.id;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(deleteKey(expenseId))) {
                headingRef.current?.focus();
              }
            };
            closeDelete();
          }}
        />
      )}
    </ExpensesView>
  );
}

export function OrderExpensesTab({ order, readOnly }: OrderExpensesTabProps) {
  if (readOnly === true || !canEditOrder(order)) {
    return <ExpensesView order={order} columns={COLUMNS} />;
  }
  return <EditableExpenses order={order} />;
}
