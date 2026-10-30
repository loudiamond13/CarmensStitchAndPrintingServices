// The Expenses tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-12, D-15, D-54a; plans 08-12, 08-18): internal costs of the order with
// who paid and who recorded each one, and an Order expenses footer from the server's figure. Staff only: the customer never sees it.
// On an active order the head has Add Expense; a locked order, and the deleted view (`readOnly`), show the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderExpenseModal } from '@/modules/admin/components/OrderExpenseModal';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_EXPENSE_COPY } from '@/modules/admin/orderExpenseCopy';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';

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

/** An active order: Add Expense in the head. */
function EditableExpenses({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderExpenseModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen) {
      returnFocus.current = null;
      go();
    }
  });

  return (
    <ExpensesView
      order={order}
      columns={COLUMNS}
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
    </ExpensesView>
  );
}

export function OrderExpensesTab({ order, readOnly }: OrderExpensesTabProps) {
  if (readOnly === true || !canEditOrder(order)) {
    return <ExpensesView order={order} columns={COLUMNS} />;
  }
  return <EditableExpenses order={order} />;
}
