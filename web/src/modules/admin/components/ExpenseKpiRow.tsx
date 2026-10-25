// The three month cards above the Company Expenses toolbar (CEXP-03, D-24; UI-SPEC E1 "KPI row"). Every figure, count, share
// and month comes from GET /company-expenses/kpis; the browser only formats them (Core Value). The row ignores the list
// filters, so it has its own query and a list change never reads it again.
import { KpiCard } from '@/components/money';
import { expensesKpiRowClasses } from '@/modules/admin/components/expenses.recipe';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useExpenseKpisQuery } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { formatPeso } from '@/utils/csps';
import { formatMonthShort } from '@/utils/format';

const COPY = EXPENSES_COPY.kpis;

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

export function ExpenseKpiRow() {
  const kpis = useExpenseKpisQuery().data;
  if (kpis === undefined) {
    return null;
  }

  const thisMonth = formatMonthShort(kpis.thisMonth.month);
  const top = kpis.topCategory;
  return (
    <div className={expensesKpiRowClasses}>
      <KpiCard
        label={COPY.thisMonth(thisMonth)}
        value={toNumber(kpis.thisMonth.total)}
        icon="receipt"
        hint={COPY.entries(toNumber(kpis.thisMonth.count))}
      />
      <KpiCard
        label={COPY.lastMonth(formatMonthShort(kpis.lastMonth.month))}
        value={toNumber(kpis.lastMonth.total)}
        icon="calendar"
        hint={COPY.fullMonth}
      />
      {top !== null && (
        <KpiCard
          label={COPY.topCategory(thisMonth)}
          value={top.category.name}
          money={false}
          icon="trending-up"
          hint={COPY.topFoot(formatPeso(toNumber(top.total)), toNumber(top.sharePercent))}
        />
      )}
    </div>
  );
}
