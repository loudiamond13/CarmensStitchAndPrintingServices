// OrderTotals (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4 and §9.2), converted to utilities (D-33) with the App.
// D.3 props and markup: the Total / Total Discount / Total Paid list, the balance block (due: "Balance due" and the
// figure; fully paid: "Balance" and the check with "Fully Paid"), and in the panel the dashed list of Order Expenses
// and Estimated Profit with the internal-only note. The looks are in money.recipe.ts.
//
// The component does no money arithmetic (T-02-55). Every figure comes from `totals` when the caller has the server's
// figures (D-09: once a save returns, screens show the server's totals), or else from csps.ts `orderTotals`, the
// golden-vector-proven preview with the D-09 centavo rounding. formatPeso writes each one; Total Discount and Total
// Paid are shown as negatives by flipping the sign of the figure, as App. D.3 does.
import clsx from 'clsx';
import { formatPeso, orderTotals, type Order, type Totals } from '@/lib/csps';
import { Icon } from '@/ui/brand';
import {
  balanceClasses,
  balanceOverlineClasses,
  balancePaidClasses,
  balanceToneClasses,
  balanceValueClasses,
  totalsClasses,
  totalsFigureClasses,
  totalsInternalClasses,
  totalsNegativeClasses,
  totalsNoteClasses,
  totalsRowClasses,
  totalsRowsClasses,
  totalsTermClasses,
  type TotalsVariant,
} from './money.recipe';

export interface OrderTotalsProps {
  /** The order to preview with csps.ts `orderTotals` when no `totals` are given. */
  order?: Partial<Order> | undefined;
  /** The server's figures for a saved order (D-09); they win over a preview of `order`. */
  totals?: Totals | undefined;
  /** "card" = the compact block inside OrderCard; "panel" = Order Detail (adds expenses and profit). */
  variant?: TotalsVariant | undefined;
}

export function OrderTotals({ order, totals, variant = 'panel' }: OrderTotalsProps) {
  const t = totals ?? orderTotals(order);
  const state = t.fullyPaid ? 'paid' : 'due';
  const rows: readonly (readonly [string, number])[] = [
    ['Total', t.total],
    ['Total Discount', -t.discount],
    ['Total Paid', -t.paid],
  ];
  return (
    <div className={totalsClasses[variant]}>
      <dl className={totalsRowsClasses[variant]}>
        {rows.map(([label, value]) => (
          <div key={label} className={totalsRowClasses[variant]}>
            <dt className={totalsTermClasses.normal}>{label}</dt>
            <dd className={totalsFigureClasses}>{formatPeso(value)}</dd>
          </div>
        ))}
      </dl>
      <div className={clsx(balanceClasses[variant], balanceToneClasses[state])}>
        <span className={balanceOverlineClasses[state]}>{t.fullyPaid ? 'Balance' : 'Balance due'}</span>
        {t.fullyPaid ? (
          <span className={balancePaidClasses}>
            <Icon name="circle-check" size={variant === 'card' ? 18 : 22} />
            Fully Paid
          </span>
        ) : (
          <span className={balanceValueClasses[variant]}>{formatPeso(t.balance)}</span>
        )}
      </div>
      {variant === 'panel' && (
        <dl className={clsx(totalsRowsClasses.panel, totalsInternalClasses)}>
          <div className={totalsRowClasses.panel}>
            <dt className={totalsTermClasses.normal}>Order Expenses</dt>
            <dd className={totalsFigureClasses}>{formatPeso(t.expenses)}</dd>
          </div>
          <div className={totalsRowClasses.panel}>
            <dt className={totalsTermClasses.strong}>Estimated Profit</dt>
            <dd className={clsx(totalsFigureClasses, t.profit < 0 && totalsNegativeClasses)}>{formatPeso(t.profit)}</dd>
          </div>
          {/* SPEC-DEVIATION: A11Y-01 (axe definition-list). App. D.3 puts this paragraph straight inside the <dl>,
              which a <dl> may not hold, so assistive technology can misread the list. The paragraph keeps its place
              and look and takes role="definition": it defines how the Estimated Profit above is worked out. */}
          <p role="definition" className={totalsNoteClasses}>
            Profit = Total − Discount − Expenses. Internal only.
          </p>
        </dl>
      )}
    </div>
  );
}
