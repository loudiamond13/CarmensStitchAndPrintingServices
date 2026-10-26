// OrderCard (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4), converted to utilities (D-33) with the App. D.3 props,
// markup and copy: the 16:10 cover button (image or placeholder, the status badge, the image count), the order number
// and piece count, the team (or the customer when there is no team) and the customer line ("Walk-in customer" when
// there is no team, D-40), the order and due dates,
// the compact OrderTotals, and the View / Edit / Delete actions. The looks are in data.recipe.ts.
//
// The component does no money arithmetic: the figures come from `totals` when the caller has the server's figures
// (D-09), or else from OrderTotals' csps.ts `orderTotals` preview, exactly as App. D.3 computes them for the card.
// SPEC-DEVIATION: D-09 the optional `totals` prop (extending by a prop, spec §0 rule 3) passes the server's figures to
// OrderTotals; without it the card shows App. D.3's `orderTotals(order)` result.
// SPEC-DEVIATION: D-40 (owner, 2026-10-08) an order with no team shows the customer as the title, as App. D.3 does, and
// "Walk-in customer" (WALK_IN_CUSTOMER, the spec §8.3 table-row wording) on the customer line, which App. D.3 leaves
// empty. The line keeps its own look.
// SPEC-DEVIATION: ORD-09 the order and due dates are date-only fields, so they go through format.ts
// `formatCalendarDate` (no zone shift, whatever the machine's zone) instead of csps.ts `formatDate`; the text is the
// same ("Sep 28, 2026").
// SPEC-DEVIATION: UI-WR-12 (WCAG 1.3.1, 4.1.2) App. D.3 names the cover button "View order {number}", which hides the
// status badge and the image count inside it from assistive technology; the name now carries them ("View order
// ORD-2026-0148, In Production, 4 images"). The View and Edit buttons are named "View order {number}" and "Edit order
// {number}" (the visible word first, WCAG 2.5.3), as Delete already is, so the cards' buttons are told apart.
// Attributes only; no visual change.
import clsx from 'clsx';
import { ORDER_STATUSES, type Order, type Totals } from '@/utils/csps';
import { formatCalendarDate, formatCount } from '@/utils/format';
import { Button } from '@/components/actions';
import { Icon, MediaPlaceholder } from '@/components/brand';
import { OrderTotals } from '@/components/money';
import { EmptyValue } from '@/components/states';
import { isOrderStatus, StatusBadge } from '@/components/status';
import { WALK_IN_CUSTOMER } from './copy';
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
  orderLastActionClasses,
  orderMediaClasses,
  orderNumberClasses,
  orderOverdueClasses,
  orderPlaceholderClasses,
  orderQtyClasses,
  orderStatusBadgeClasses,
  orderStatusClasses,
  orderTeamClasses,
} from './data.recipe';

export interface OrderCardProps {
  order: Order;
  /** The server's figures for the order (D-09); without them the card previews `orderTotals(order)`. */
  totals?: Totals | undefined;
  onView?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

export function OrderCard({ order, totals, onView, onEdit, onDelete }: OrderCardProps) {
  const o = order;
  const images = o.images ?? [];
  const cover = images[0];
  const qty = (o.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  // What the cover shows, in words: the status badge's text, then the image count chip when there is one.
  const statusLabel = isOrderStatus(o.status) ? ORDER_STATUSES[o.status] : o.status;
  const coverName = [
    `View order ${o.number}`,
    statusLabel,
    images.length > 1 ? `${formatCount(images.length)} images` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <article className={orderCardClasses}>
      <button type="button" className={orderMediaClasses} onClick={onView} aria-label={coverName}>
        {cover?.src ? (
          <img src={cover.src} alt="" className={orderImageClasses} />
        ) : (
          <MediaPlaceholder
            label={cover ? (cover.name ?? '') : 'No images yet'}
            number={cover?.number}
            ratio="16 / 10"
            className={orderPlaceholderClasses}
          />
        )}
        <span className={orderStatusClasses}>
          <StatusBadge status={o.status} className={orderStatusBadgeClasses} />
        </span>
        {images.length > 1 && (
          <span className={orderCountClasses}>
            <Icon name="image" size={14} />
            {formatCount(images.length)}
          </span>
        )}
      </button>
      <div className={orderBodyClasses}>
        <div className={orderHeadClasses}>
          <span className={orderNumberClasses}>{o.number}</span>
          <span className={orderQtyClasses}>{qty} pcs</span>
        </div>
        <h3 className={orderTeamClasses}>{o.team || o.customer}</h3>
        <p className={orderCustomerClasses}>{o.team ? o.customer : WALK_IN_CUSTOMER}</p>
        <div className={orderDatesClasses}>
          <span className={orderDateClasses}>
            <Icon name="calendar" size={14} />
            {formatCalendarDate(o.orderDate) ?? <EmptyValue />}
          </span>
          <span className={clsx(orderDateClasses, o.overdue && orderOverdueClasses)}>
            <Icon name="clock" size={14} />
            Due {formatCalendarDate(o.dueDate) ?? <EmptyValue />}
          </span>
        </div>
        <OrderTotals order={o} totals={totals} variant="card" />
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
          View
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="pencil"
          onClick={() => {
            onEdit?.();
          }}
          aria-label={`Edit order ${o.number}`}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost-danger"
          icon="trash-2"
          onClick={() => {
            onDelete?.();
          }}
          aria-label={`Delete order ${o.number}`}
          className={orderLastActionClasses}
        />
      </div>
    </article>
  );
}
