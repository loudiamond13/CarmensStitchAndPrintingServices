// OrderCard (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4), converted to utilities (D-33): the 16:10 cover button
// (placeholder or image, the status badge, the image count), the order number and piece count, the team (or the customer
// when there is no team) and the customer line, the order and due dates, the compact OrderTotals, and the View Order and
// Edit Details actions. The looks are in data.recipe.ts.
//
// SPEC-DEVIATION: plan 08-02 (owner, 2026-10-29). The card takes an order list row (the API's OrderListEntry field
// names) and shows the server's figures as they come, with no browser arithmetic (D-09): `order` replaces App. D.3's
// `order` plus `totals`. It has no Delete action (D-22), shows "No images yet" until Phase 9 gives it a `cover` (D-27),
// the piece count from the row (D-40) and the actions "View Order" and "Edit Details" (D-46, D-57), the second hidden on a
// Completed or Cancelled order (D-15). The `due` slot takes the module's due flag; without it the card shows the date.
// SPEC-DEVIATION: D-40 (owner, 2026-10-08) an order with no team shows the customer as the title, and "Walk-in customer"
// (WALK_IN_CUSTOMER) on the customer line, which App. D.3 leaves empty.
// SPEC-DEVIATION: ORD-09 the order and due dates are date-only fields, so they go through format.ts
// `formatCalendarDate` (no zone shift, whatever the machine's zone); the text is the same ("Sep 28, 2026").
// SPEC-DEVIATION: UI-WR-12 (WCAG 1.3.1, 4.1.2) the cover button's name carries the status and the image count ("View
// order ORD-2026-0148, In Production, 4 images"); the View and Edit buttons are named by their order, the visible words
// first (WCAG 2.5.3). Attributes only; no visual change.
import type { ReactNode } from 'react';
import { ORDER_STATUSES, type OrderFigures, type OrderStatus } from '@/utils/csps';
import { formatCalendarDate, formatCount } from '@/utils/format';
import { Button } from '@/components/actions';
import { Icon, MediaPlaceholder } from '@/components/brand';
import { OrderTotals } from '@/components/money';
import { EmptyValue } from '@/components/states';
import { isOrderStatus, StatusBadge } from '@/components/status';
import { ORDER_CARD_COPY, WALK_IN_CUSTOMER } from './copy';
import {
  orderActionsClasses,
  orderBodyClasses,
  orderCardClasses,
  orderCountClasses,
  orderCustomerClasses,
  orderDateClasses,
  orderDatesClasses,
  orderHeadClasses,
  orderImageClasses,
  orderMediaClasses,
  orderNumberClasses,
  orderPlaceholderClasses,
  orderQtyClasses,
  orderStatusBadgeClasses,
  orderStatusClasses,
  orderTeamClasses,
} from './data.recipe';

/** An order list row as the card needs it: the list API's field names, the figures as the server sent them. */
export interface OrderCardOrder extends OrderFigures {
  number: string;
  teamName: string | null;
  customerName: string;
  status: OrderStatus;
  orderDate: string;
  dueDate: string | null;
  /** How many pieces: the sum of the item quantities (D-40). */
  pieces: number | string;
}

/** The cover once the images exist (Phase 9): a file, or a named placeholder, with how many images the order has. */
export interface OrderCardCover {
  src?: string | undefined;
  name?: string | undefined;
  /** The jersey number drawn big on the placeholder. */
  number?: string | undefined;
  count?: number | undefined;
}

export interface OrderCardProps {
  order: OrderCardOrder;
  /** Replaces the plain due date after the clock icon (the due flag of the order screens). */
  due?: ReactNode;
  /** The first image; without it the cover is the "No images yet" placeholder (D-27). */
  cover?: OrderCardCover | undefined;
  onView?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
}

export function OrderCard({ order, due, cover, onView, onEdit }: OrderCardProps) {
  const o = order;
  const images = cover?.count ?? 0;
  const pieces = Number(o.pieces) || 0;
  const locked = o.status === 'completed' || o.status === 'cancelled';
  // What the cover shows, in words: the status badge's text, then the image count chip when there is one.
  const statusLabel = isOrderStatus(o.status) ? ORDER_STATUSES[o.status] : o.status;
  const coverName = [`View order ${o.number}`, statusLabel, images > 1 ? `${formatCount(images)} images` : '']
    .filter(Boolean)
    .join(', ');
  return (
    <article className={orderCardClasses}>
      <button type="button" className={orderMediaClasses} onClick={onView} aria-label={coverName}>
        {cover?.src ? (
          <img src={cover.src} alt="" className={orderImageClasses} />
        ) : (
          <MediaPlaceholder
            label={cover ? (cover.name ?? '') : ORDER_CARD_COPY.noImages}
            number={cover?.number}
            ratio="16 / 10"
            className={orderPlaceholderClasses}
          />
        )}
        <span className={orderStatusClasses}>
          <StatusBadge status={o.status} className={orderStatusBadgeClasses} />
        </span>
        {images > 1 && (
          <span className={orderCountClasses}>
            <Icon name="image" size={14} />
            {formatCount(images)}
          </span>
        )}
      </button>
      <div className={orderBodyClasses}>
        <div className={orderHeadClasses}>
          <span className={orderNumberClasses}>{o.number}</span>
          <span className={orderQtyClasses}>{formatCount(pieces)} pcs</span>
        </div>
        <h3 className={orderTeamClasses}>{o.teamName || o.customerName}</h3>
        <p className={orderCustomerClasses}>{o.teamName ? o.customerName : WALK_IN_CUSTOMER}</p>
        <div className={orderDatesClasses}>
          <span className={orderDateClasses}>
            <Icon name="calendar" size={14} />
            {formatCalendarDate(o.orderDate) ?? <EmptyValue />}
          </span>
          <span className={orderDateClasses}>
            <Icon name="clock" size={14} />
            {due ?? <>Due {formatCalendarDate(o.dueDate ?? '') ?? <EmptyValue />}</>}
          </span>
        </div>
        <OrderTotals totals={o} status={o.status} variant="card" />
      </div>
      <div className={orderActionsClasses}>
        <Button
          size="sm"
          variant="ghost"
          icon="eye"
          onClick={() => {
            onView?.();
          }}
          aria-label={`View order ${o.number}`}
        >
          {ORDER_CARD_COPY.view}
        </Button>
        {!locked && (
          <Button
            size="sm"
            variant="ghost"
            icon="pencil"
            onClick={() => {
              onEdit?.();
            }}
            aria-label={`Edit details of order ${o.number}`}
          >
            {ORDER_CARD_COPY.editDetails}
          </Button>
        )}
      </div>
    </article>
  );
}
