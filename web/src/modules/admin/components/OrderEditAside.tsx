// The Summary card beside the Edit Order form (UI-SPEC F2; plan 08-15): the order number, its StatusBadge, and who recorded and last
// changed it (RecordMeta, SEC-08). Read-only: the status changes on the order page, and the figures are not shown here.
import { useId } from 'react';
import { RecordMeta } from '@/components/data';
import { StatusBadge } from '@/components/status';
import {
  orderAsideBodyClasses,
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
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';

const COPY = ORDER_FORM_COPY;

export interface OrderEditAsideProps {
  /** The order as the form opened with it. */
  order: Pick<
    OrderDetailResponse,
    'number' | 'status' | 'recordedBy' | 'recordedAt' | 'lastChangedBy' | 'lastChangedAt'
  >;
}

export function OrderEditAside({ order }: OrderEditAsideProps) {
  const headingId = useId();
  return (
    <aside className={orderFormAsideClasses} aria-labelledby={headingId}>
      <div className={orderFormCardClasses}>
        <div className={orderFormCardHeadClasses}>
          <div>
            <h2 id={headingId} className={orderFormCardTitleClasses}>
              {COPY.aside.title}
            </h2>
            <p className={orderFormCardHintClasses}>{COPY.edit.aside.hint}</p>
          </div>
        </div>
        <div className={orderAsideBodyClasses}>
          <dl className={orderMetaClasses}>
            <dt className={orderMetaTermClasses}>{COPY.edit.aside.order}</dt>
            <dd className={orderMetaValueClasses}>{order.number}</dd>
            <dt className={orderMetaTermClasses}>{COPY.aside.status}</dt>
            <dd className={orderMetaValueClasses}>
              <StatusBadge status={order.status as OrderStatus} />
            </dd>
          </dl>
          <RecordMeta
            recordedBy={order.recordedBy}
            recordedAt={order.recordedAt}
            lastChangedBy={order.lastChangedBy}
            lastChangedAt={order.lastChangedAt}
          />
        </div>
      </div>
    </aside>
  );
}
