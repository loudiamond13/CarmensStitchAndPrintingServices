// OrderTotals (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4 and §9.2), converted to utilities (D-33): the figure list,
// the balance block, and in the panel the dashed list of Order Expenses and Estimated Profit with its note. The looks are
// in money.recipe.ts.
//
// The component does no money arithmetic (T-02-55). Every figure comes from `totals`, the server's figures for a saved
// order (D-09), and goes to formatPeso as the number or text the API sent. Only the create form's aside and the showcase
// pass `order`, which csps.ts `orderTotals` previews with the D-09 centavo rounding. Signs are judged by the centavo
// (isPositiveMoney, isNegativeMoney), never by a float compare.
//
// SPEC-DEVIATION: D-01 to D-03 (owner, 2026-10-29). App. D.3's row names give way to the
// PRD names: Subtotal, Discount (shown negative), Total, Paid (shown negative), and Refunded (shown +, only when
// something was refunded).
// SPEC-DEVIATION: D-02, D-45 (owner, 2026-10-29). The balance block has four states, first match wins: Customer credit
// (info ground, never a negative balance), Fully Paid, Not collected (a Cancelled order with money unpaid, neutral
// ground), else Balance due. The panel's credit block offers Record Refund when the caller gives `onRecordRefund` (D-19).
// SPEC-DEVIATION: D-04 (owner, 2026-10-29). The card shows one Total row, and a credit as an info "Credit ₱X" badge.
// SPEC-DEVIATION: D-06, D-07 (owner, 2026-10-29). Expenses and profit show in the panel only, with a note that follows
// the status: the note ends "Staff only." and a Cancelled order explains its profit.
import clsx from 'clsx';
import {
  formatPeso,
  isNegativeMoney,
  isPositiveMoney,
  negateMoney,
  orderTotals,
  type Order,
  type OrderFigures,
  type OrderStatus,
} from '@/utils/csps';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Badge } from '@/components/status';
import {
  balanceClasses,
  balanceLineClasses,
  balanceOverlineClasses,
  balancePaidClasses,
  balanceToneClasses,
  balanceValueClasses,
  balanceWrapClasses,
  totalsClasses,
  totalsFigureClasses,
  totalsInternalClasses,
  totalsNegativeClasses,
  totalsNoteClasses,
  totalsRowClasses,
  totalsRowsClasses,
  totalsTermClasses,
  type BalanceState,
  type TotalsVariant,
} from './money.recipe';

const COPY = {
  creditLine: 'Paid over the total. Record a refund to clear it.',
  recordRefund: 'Record Refund',
  profitNote: 'Profit = Total − Expenses. Staff only.',
  cancelledProfitNote: 'Cancelled: profit = money kept (Paid − Refunded) − Expenses. Staff only.',
} as const;

export interface OrderTotalsProps {
  /** The order to preview with csps.ts `orderTotals` when no `totals` are given (create form aside, showcase). */
  order?: Partial<Order> | undefined;
  /** The server's figures for a saved order (D-09); they win over a preview of `order`. */
  totals?: OrderFigures | undefined;
  /** The order's status: it picks the profit note (D-07) and the Not collected block (D-45). */
  status?: OrderStatus | undefined;
  /** Shows Record Refund in the panel's credit block (D-19); the screen decides who may refund. */
  onRecordRefund?: (() => void) | undefined;
  /** "card" = the compact block inside OrderCard; "panel" = Order Detail (adds expenses and profit). */
  variant?: TotalsVariant | undefined;
}

/** The preview of an order as figures: no refunds, and an overpayment as a credit, never a negative balance. */
function previewFigures(order: Partial<Order> | undefined): OrderFigures {
  const t = orderTotals(order);
  const overpaid = isNegativeMoney(t.balance);
  return {
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    paid: t.paid,
    refunded: 0,
    balance: overpaid ? 0 : t.balance,
    customerCredit: overpaid ? -t.balance : 0,
    fullyPaid: t.fullyPaid,
    expenses: t.expenses,
    profit: t.profit,
  };
}

type Row = readonly [label: string, value: string];

type BalanceKind = 'credit' | 'paid' | 'notCollected' | 'due';

/** The recipe state of each kind: the credit block is info on the panel and neutral on the card (D-04). */
const BALANCE_STATE = {
  panelCredit: 'credit',
  credit: 'neutral',
  paid: 'paid',
  notCollected: 'neutral',
  due: 'due',
} as const satisfies Record<BalanceKind | 'panelCredit', BalanceState>;

/** The overline of each kind; the card's credit block says "Balance" next to its badge. */
function overline(kind: BalanceKind, variant: TotalsVariant): string {
  if (kind === 'credit') return variant === 'panel' ? 'Customer credit' : 'Balance';
  if (kind === 'paid') return 'Balance';
  return kind === 'notCollected' ? 'Not collected' : 'Balance due';
}

/** The balance block's state, first match wins (D-02, ORD-12, D-45): credit, Fully Paid, Not collected, else due. */
function balanceKind(t: OrderFigures, status: OrderStatus | undefined): BalanceKind {
  if (isPositiveMoney(t.customerCredit)) return 'credit';
  if (t.fullyPaid) return 'paid';
  if (status === 'cancelled' && isPositiveMoney(t.balance)) return 'notCollected';
  return 'due';
}

export function OrderTotals({ order, totals, status, onRecordRefund, variant = 'panel' }: OrderTotalsProps) {
  const t = totals ?? previewFigures(order);
  const kind = balanceKind(t, status);
  const panelCredit = kind === 'credit' && variant === 'panel';
  const state: BalanceState = BALANCE_STATE[kind === 'credit' && variant === 'panel' ? 'panelCredit' : kind];
  const rows: readonly Row[] =
    variant === 'card'
      ? [['Total', formatPeso(t.total)]]
      : [
          ['Subtotal', formatPeso(t.subtotal)],
          ['Discount', formatPeso(negateMoney(t.discount))],
          ['Total', formatPeso(t.total)],
          ['Paid', formatPeso(negateMoney(t.paid))],
          ...(isPositiveMoney(t.refunded) ? [['Refunded', `+${formatPeso(t.refunded)}`] as const] : []),
        ];
  const showInternal = variant === 'panel' && t.expenses !== undefined && t.profit !== undefined;
  const iconSize = variant === 'card' ? 18 : 22;
  return (
    <div className={totalsClasses[variant]}>
      <dl className={totalsRowsClasses[variant]}>
        {rows.map(([label, value]) => (
          <div key={label} className={totalsRowClasses[variant]}>
            <dt className={totalsTermClasses.normal}>{label}</dt>
            <dd className={totalsFigureClasses}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={clsx(balanceClasses[variant], balanceToneClasses[state], panelCredit && balanceWrapClasses)}>
        <span className={balanceOverlineClasses[state]}>{overline(kind, variant)}</span>
        {kind === 'credit' && variant === 'card' ? (
          <Badge tone="info">{`Credit ${formatPeso(t.customerCredit)}`}</Badge>
        ) : kind === 'credit' ? (
          <>
            <span className={balanceValueClasses.panel}>{formatPeso(t.customerCredit)}</span>
            <p className={balanceLineClasses}>{COPY.creditLine}</p>
            {onRecordRefund !== undefined && (
              <Button size="sm" variant="secondary" icon="plus" onClick={onRecordRefund}>
                {COPY.recordRefund}
              </Button>
            )}
          </>
        ) : kind === 'paid' ? (
          <span className={balancePaidClasses}>
            <Icon name="circle-check" size={iconSize} />
            Fully Paid
          </span>
        ) : (
          <span className={balanceValueClasses[variant]}>{formatPeso(t.balance)}</span>
        )}
      </div>
      {showInternal && (
        <dl className={clsx(totalsRowsClasses.panel, totalsInternalClasses)}>
          <div className={totalsRowClasses.panel}>
            <dt className={totalsTermClasses.normal}>Order Expenses</dt>
            <dd className={totalsFigureClasses}>{formatPeso(t.expenses)}</dd>
          </div>
          <div className={totalsRowClasses.panel}>
            <dt className={totalsTermClasses.strong}>Estimated Profit</dt>
            <dd className={clsx(totalsFigureClasses, isNegativeMoney(t.profit) && totalsNegativeClasses)}>
              {formatPeso(t.profit)}
            </dd>
          </div>
          {/* SPEC-DEVIATION: A11Y-01 (axe definition-list). App. D.3 puts this paragraph straight inside the <dl>,
              which a <dl> may not hold, so assistive technology can misread the list. The paragraph keeps its place
              and look and takes role="definition": it defines how the Estimated Profit above is worked out. */}
          <p role="definition" className={totalsNoteClasses}>
            {status === 'cancelled' ? COPY.cancelledProfitNote : COPY.profitNote}
          </p>
        </dl>
      )}
    </div>
  );
}
