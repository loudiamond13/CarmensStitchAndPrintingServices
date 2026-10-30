// The Summary card beside the New Order form (UI-SPEC F1 Aside; plan 08-13): status, due date, line items, pieces and the TOTAL.
// Every figure is a PREVIEW from what is typed (D-09); the saved figures are the server's, shown on the order page after the save.
// The card is not a live region: it changes with every keystroke and would talk over the person typing.
import { useId } from 'react';
import { EmptyValue, Note } from '@/components/states';
import { StatusBadge } from '@/components/status';
import {
  orderAsideBodyClasses,
  orderAsideTotalClasses,
  orderAsideTotalFigureClasses,
  orderAsideTotalOverlineClasses,
  orderFormAsideClasses,
  orderFormCardClasses,
  orderFormCardHeadClasses,
  orderFormCardHintClasses,
  orderFormCardTitleClasses,
} from '@/modules/admin/components/orderForm.recipe';
import {
  orderMetaClasses,
  orderMetaTermClasses,
  orderMetaValueClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_FORM_COPY } from '@/modules/admin/orderFormCopy';
import { formatPeso, type OrderStatus } from '@/utils/csps';
import { formatCalendarDate, formatCount } from '@/utils/format';

const COPY = ORDER_FORM_COPY.aside;

export interface OrderSummaryAsideProps {
  /** The status chosen in the form. */
  status: string;
  /** The due date typed so far (`yyyy-MM-dd`), or text that is not a date yet. */
  dueDate: string;
  lineItems: number;
  pieces: number;
  /** The items subtotal preview, which is the order total at creation. */
  total: number;
}

export function OrderSummaryAside({ status, dueDate, lineItems, pieces, total }: OrderSummaryAsideProps) {
  const headingId = useId();
  const due = formatCalendarDate(dueDate);
  return (
    <aside className={orderFormAsideClasses} aria-labelledby={headingId}>
      <div className={orderFormCardClasses}>
        <div className={orderFormCardHeadClasses}>
          <div>
            <h2 id={headingId} className={orderFormCardTitleClasses}>
              {COPY.title}
            </h2>
            <p className={orderFormCardHintClasses}>{COPY.hint}</p>
          </div>
        </div>
        <div className={orderAsideBodyClasses}>
          <dl className={orderMetaClasses}>
            <dt className={orderMetaTermClasses}>{COPY.status}</dt>
            <dd className={orderMetaValueClasses}>
              <StatusBadge status={status as OrderStatus} />
            </dd>
            <dt className={orderMetaTermClasses}>{COPY.due}</dt>
            <dd className={orderMetaValueClasses}>{due ?? <EmptyValue />}</dd>
            <dt className={orderMetaTermClasses}>{COPY.lineItems}</dt>
            <dd className={orderMetaValueClasses}>{formatCount(lineItems)}</dd>
            <dt className={orderMetaTermClasses}>{COPY.pieces}</dt>
            <dd className={orderMetaValueClasses}>{formatCount(pieces)}</dd>
          </dl>
          <div className={orderAsideTotalClasses}>
            <span className={orderAsideTotalOverlineClasses}>{COPY.total}</span>
            <strong className={orderAsideTotalFigureClasses}>{formatPeso(total)}</strong>
          </div>
          <Note icon="info">{COPY.note}</Note>
        </div>
      </div>
    </aside>
  );
}
