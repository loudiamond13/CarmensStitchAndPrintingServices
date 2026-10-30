// The customer card of the order page (UI-SPEC O1 Side 2; plan 08-12): name, team, contact, email and address with an icon each
// (the empty value when missing), the order notes in a note, and an Edit Details link while the order is open. Text only, never
// HTML (CWE-79, T-08-22). `readOnly` (the deleted view, D-24) hides the link.
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { EmptyValue, Note } from '@/components/states';
import {
  orderCardBodyClasses,
  orderCardClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
  orderMetaClasses,
  orderMetaRowClasses,
  orderMetaTermClasses,
  orderMetaValueClasses,
  orderNotesClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const COPY = ORDER_PAGE_COPY.customer;
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
              <div key={row.label} className={orderMetaRowClasses}>
                <dt className={orderMetaTermClasses}>
                  <Icon name={row.icon} size={16} />
                  {row.label}
                </dt>
                <dd className={orderMetaValueClasses}>{value === null || value === '' ? <EmptyValue /> : value}</dd>
              </div>
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
