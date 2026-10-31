// The slim balance card of the order page on phones (UI-SPEC O1 Slim balance card; D-33; plan 08-12): one full-width button under
// the header with the Total, and the balance as Balance due, Fully Paid, Credit or Not collected, from the server's figures. It
// scrolls to the totals panel (instantly under reduced motion) and focuses the panel's heading, which has the id `order-totals`.
// Hidden above 767px by the recipe, so it leaves the accessibility tree there. No money is worked out here.
import { Icon } from '@/components/brand';
import { Badge } from '@/components/status';
import {
  orderBalanceStripClasses,
  orderStripBalanceClasses,
  orderStripColumnClasses,
  orderStripEndClasses,
  orderStripFigureClasses,
  orderStripOverlineClasses,
  orderStripPaidClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';

const COPY = ORDER_PAGE_COPY.strip;
/** The id of the Totals heading the page puts on its panel. */
const TOTALS_ID = 'order-totals';

type StripState = 'credit' | 'paid' | 'notCollected' | 'due';

/** First match wins, as in the totals panel: credit, Fully Paid, Not collected (Cancelled with money unpaid), else due. */
function stripState(totals: OrderDetailResponse['totals'], status: string): StripState {
  if (isPositiveMoney(totals.customerCredit)) return 'credit';
  if (totals.fullyPaid) return 'paid';
  if (status === 'cancelled' && isPositiveMoney(totals.balance)) return 'notCollected';
  return 'due';
}

function goToTotals(): void {
  const heading = document.getElementById(TOTALS_ID);
  if (heading === null) {
    return;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
}

export interface OrderBalanceStripProps {
  totals: OrderDetailResponse['totals'];
  /** The order's status key; it tells a Cancelled order's unpaid balance from a balance due. */
  status: string;
}

export function OrderBalanceStrip({ totals, status }: OrderBalanceStripProps) {
  const state = stripState(totals, status);
  const total = formatPeso(totals.total);
  const balance = formatPeso(totals.balance);
  const credit = formatPeso(totals.customerCredit);
  const name = {
    due: COPY.nameDue(total, balance),
    notCollected: COPY.nameNotCollected(total, balance),
    paid: COPY.namePaid(total),
    credit: COPY.nameCredit(total, credit),
  }[state];
  return (
    <button type="button" className={orderBalanceStripClasses} aria-label={name} onClick={goToTotals}>
      <span className={orderStripColumnClasses}>
        <span className={orderStripOverlineClasses.neutral}>{COPY.total}</span>
        <span className={orderStripFigureClasses}>{total}</span>
      </span>
      <span className={orderStripEndClasses}>
        <span className={orderStripBalanceClasses}>
          {state === 'due' && (
            <>
              <span className={orderStripOverlineClasses.due}>{COPY.balanceDue}</span>
              <span className={orderStripFigureClasses}>{balance}</span>
            </>
          )}
          {state === 'notCollected' && (
            <>
              <span className={orderStripOverlineClasses.neutral}>{COPY.notCollected}</span>
              <span className={orderStripFigureClasses}>{balance}</span>
            </>
          )}
          {state === 'paid' && (
            <span className={orderStripPaidClasses}>
              <Icon name="circle-check" size={18} />
              {COPY.fullyPaid}
            </span>
          )}
          {state === 'credit' && <Badge tone="info">{COPY.credit(credit)}</Badge>}
        </span>
        <Icon name="chevron-down" size={20} />
      </span>
    </button>
  );
}
