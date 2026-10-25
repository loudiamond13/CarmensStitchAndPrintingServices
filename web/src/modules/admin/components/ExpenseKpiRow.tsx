// The three month cards above the Company Expenses toolbar (CEXP-03, D-24; UI-SPEC E1 "KPI row"). Every figure, count, share
// and month comes from GET /company-expenses/kpis; the browser only formats them (Core Value). The row ignores the list
// filters, so it has its own query and a list change never reads it again. While it loads each card is a skeleton; if it
// fails the row becomes one banner with Try Again, and the list below loads on its own.
import { KpiCard } from '@/components/money';
import { ErrorState } from '@/components/states';
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
  const query = useExpenseKpisQuery();
  const kpis = query.data;

  if (kpis === undefined && query.isError) {
    return (
      <ErrorState
        things={COPY.errorThings}
        align="start"
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  // Until the answer arrives the labels carry no month: the month is the server's to name, never the device clock's.
  const thisMonth = kpis === undefined ? null : formatMonthShort(kpis.thisMonth.month);
  const top = kpis?.topCategory ?? null;
  return (
    <div className={expensesKpiRowClasses}>
      <KpiCard
        label={COPY.thisMonth(thisMonth)}
        value={kpis === undefined ? 0 : toNumber(kpis.thisMonth.total)}
        icon="receipt"
        hint={kpis === undefined ? undefined : COPY.entries(toNumber(kpis.thisMonth.count))}
        loading={kpis === undefined}
      />
      <KpiCard
        label={COPY.lastMonth(kpis === undefined ? null : formatMonthShort(kpis.lastMonth.month))}
        value={kpis === undefined ? 0 : toNumber(kpis.lastMonth.total)}
        icon="calendar"
        hint={kpis === undefined ? undefined : COPY.fullMonth}
        loading={kpis === undefined}
      />
      <KpiCard
        label={COPY.topCategory(thisMonth)}
        value={top === null ? '' : top.category.name}
        money={false}
        icon="trending-up"
        hint={
          kpis === undefined
            ? undefined
            : top === null
              ? COPY.noExpenses
              : COPY.topFoot(formatPeso(toNumber(top.total)), toNumber(top.sharePercent))
        }
        empty={kpis !== undefined && top === null}
        loading={kpis === undefined}
      />
    </div>
  );
}
