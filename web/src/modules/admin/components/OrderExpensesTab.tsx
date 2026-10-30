// The Expenses tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-12; plan 08-12): internal costs of the order with who paid
// and who recorded each one, and an Order expenses footer from the server's figure. Staff only: the customer never sees it. The
// Add, Edit and Delete windows join in plan 08-17 and render nothing while `readOnly` (the deleted view, D-24).
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';

type OrderExpense = OrderDetailResponse['expenses'][number];

const COPY = ORDER_PAGE_COPY.expenses;

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

export function OrderExpensesTab({ order }: OrderExpensesTabProps) {
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} />
      <div className={orderTabBodyClasses}>
        {order.expenses.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={COLUMNS}
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
      </div>
    </>
  );
}
