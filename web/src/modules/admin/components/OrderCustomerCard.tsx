// The customer card of the order page (UI-SPEC O1 Side 2; plan 08-12): name, team, contact, email and address with an icon each
// (the empty value when missing), the order notes in a note, and an Edit Details link while the order is open. Text only, never
// HTML (CWE-79, T-08-22). `readOnly` (the deleted view, D-24) hides the links. An order made from a quote request has a
// "From quote request" row after Email with View Request (UI-SPEC R3, D-21).
import clsx from 'clsx';
import { Fragment } from 'react';
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { EmptyValue, Note } from '@/components/states';
import {
  orderCardBodyClasses,
  orderCardClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
  orderMetaClasses,
  orderMetaLinkClasses,
  orderMetaRowClasses,
  orderMetaTermClasses,
  orderMetaValueClasses,
  orderNotesClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import { QUOTE_REQUESTS_PATH } from '@/modules/admin/quoteRequestNavigation';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const COPY = ORDER_PAGE_COPY.customer;
const LINK = QUOTE_REQUEST_COPY.orderLink;
const TITLE_ID = 'order-customer';

interface MetaRow {
  icon: IconName;
  label: string;
  value: (order: OrderDetailResponse) => string | null;
}

const ROWS: readonly MetaRow[] = [
  { icon: 'user-round', label: COPY.name, value: (order) => order.customerName },
  { icon: 'users', label: COPY.team, value: (order) => order.teamName },
  { icon: 'phone', label: COPY.contact, value: (order) => order.contactNumber },
  { icon: 'mail', label: COPY.email, value: (order) => order.email },
  { icon: 'map-pin', label: COPY.address, value: (order) => order.address },
];

export interface OrderCustomerCardProps {
  order: OrderDetailResponse;
  /** The deleted view: no Edit Details link (D-24). */
  readOnly?: boolean | undefined;
}

/** "From quote request" with View Request, only on an order made from a request; text in the deleted view. */
function QuoteRequestRow({ requestId, readOnly }: { requestId: string | null | undefined; readOnly: boolean }) {
  if (requestId === null || requestId === undefined) return null;
  return (
    <div className={orderMetaRowClasses}>
      <dt className={orderMetaTermClasses}>
        <Icon name="inbox" size={16} />
        {LINK.term}
      </dt>
      <dd className={orderMetaValueClasses}>
        {readOnly ? (
          LINK.made
        ) : (
          <UiLink
            to={`${QUOTE_REQUESTS_PATH}/${encodeURIComponent(requestId)}`}
            className={clsx(orderMetaLinkClasses, hitAreaClasses)}
          >
            {LINK.viewRequest}
            <Icon name="arrow-right" size={16} />
          </UiLink>
        )}
      </dd>
    </div>
  );
}

export function OrderCustomerCard({ order, readOnly = false }: OrderCustomerCardProps) {
  const hasNotes = order.notes !== null && order.notes.trim() !== '';
  return (
    <section className={orderCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <h2 id={TITLE_ID} className={orderCardTitleClasses}>
          {COPY.title}
        </h2>
        {!readOnly && canEditOrder(order) && (
          <UiLink to={`/admin/orders/${order.id}/edit`} className={hitAreaClasses}>
            {COPY.editDetails}
          </UiLink>
        )}
      </div>
      <div className={orderCardBodyClasses}>
        <dl className={orderMetaClasses}>
          {ROWS.map((row) => {
            const value = row.value(order);
            return (
              <Fragment key={row.label}>
                <div className={orderMetaRowClasses}>
                  <dt className={orderMetaTermClasses}>
                    <Icon name={row.icon} size={16} />
                    {row.label}
                  </dt>
                  <dd className={orderMetaValueClasses}>{value === null || value === '' ? <EmptyValue /> : value}</dd>
                </div>
                {row.label === COPY.email && <QuoteRequestRow requestId={order.quoteRequestId} readOnly={readOnly} />}
              </Fragment>
            );
          })}
        </dl>
        {hasNotes && (
          <Note icon="info">
            <span className={orderNotesClasses}>{order.notes}</span>
          </Note>
        )}
      </div>
    </section>
  );
}
