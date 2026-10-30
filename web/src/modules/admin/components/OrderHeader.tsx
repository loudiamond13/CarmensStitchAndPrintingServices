// The order page header (`.s-ph`; UI-SPEC O1 Header; plan 08-10): the back link, the order number with its status, the subline of
// team, customer, order date and due flag, who recorded and last changed the order, and Edit Details and the Change Status menu
// while the order is open.
// The due flag counts from the response's own business today, never the device clock (D-59).
import { ButtonLink, UiLink, hitAreaClasses } from '@/components/actions';
import { Icon } from '@/components/brand';
import { RecordMeta, WALK_IN_CUSTOMER } from '@/components/data';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
} from '@/components/layout/layout.recipe';
import { StatusBadge } from '@/components/status';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { OrderStatusMenu } from '@/modules/admin/components/OrderStatusMenu';
import {
  orderActionsClasses,
  orderBackRowClasses,
  orderNumberClasses,
  orderSublineStrongClasses,
  orderTitleRowClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';
import clsx from 'clsx';

const COPY = ORDER_PAGE_COPY.header;

export interface OrderHeaderProps {
  order: OrderDetailResponse;
  /** Where the back link goes: the list as the user left it, or the Orders list (D-51). */
  backTo: string;
  /** A status move succeeded and the page has the answer (the page moves focus when the order ended). */
  onStatusMoved?: ((answer: OrderDetailResponse) => void) | undefined;
}

export function OrderHeader({ order, backTo, onStatusMoved }: OrderHeaderProps) {
  const ordered = formatCalendarDate(order.orderDate) ?? order.orderDate;
  const hasTeam = order.teamName !== null && order.teamName !== '';
  return (
    <div className={pageHeadClasses}>
      <div className={pageHeadTitleClasses}>
        <div className={orderBackRowClasses}>
          <UiLink to={backTo} className={clsx(loginBackClasses, hitAreaClasses)}>
            <Icon name="chevron-left" size={16} />
            {COPY.back}
          </UiLink>
        </div>
        <div className={orderTitleRowClasses}>
          <h1 tabIndex={-1} className={orderNumberClasses}>
            {order.number}
          </h1>
          {/* The server sends one of the seven keys; the badge shows any other key as plain text. */}
          <StatusBadge status={order.status as OrderStatus} />
          {canEditOrder(order) && <OrderStatusMenu order={order} onMoved={onStatusMoved} />}
        </div>
        <p className={pageSublineClasses}>
          <strong className={orderSublineStrongClasses}>{hasTeam ? order.teamName : order.customerName}</strong>
          {COPY.separator}
          {hasTeam ? order.customerName : WALK_IN_CUSTOMER}
          {COPY.separator}
          {COPY.ordered(ordered)}
          {COPY.separator}
          <DueFlag dueDate={order.dueDate} status={order.status} today={order.today} />
        </p>
        <RecordMeta
          recordedBy={order.recordedBy}
          recordedAt={order.recordedAt}
          lastChangedBy={order.lastChangedBy}
          lastChangedAt={order.lastChangedAt}
        />
      </div>
      {canEditOrder(order) && (
        <div className={orderActionsClasses}>
          <ButtonLink variant="secondary" icon="pencil" to={`/admin/orders/${order.id}/edit`}>
            {COPY.editDetails}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
