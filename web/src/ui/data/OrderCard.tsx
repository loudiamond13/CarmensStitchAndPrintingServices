// OrderCard (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4), converted to utilities (D-33) with the App. D.3 props,
// markup and copy: the 16:10 cover button (image or placeholder, the status badge, the image count), the order number
// and piece count, the team (or the customer when there is no team) and the customer line, the order and due dates,
// the compact OrderTotals, and the View / Edit / Delete actions. The looks are in data.recipe.ts.
//
// The component does no money arithmetic: the figures come from `totals` when the caller has the server's figures
// (D-09), or else from OrderTotals' csps.ts `orderTotals` preview, exactly as App. D.3 computes them for the card.
// SPEC-DEVIATION: D-09 the optional `totals` prop (extending by a prop, spec §0 rule 3) passes the server's figures to
// OrderTotals; without it the card shows App. D.3's `orderTotals(order)` result.
// SPEC-DEVIATION: ORD-09 the order and due dates are date-only fields, so they go through format.ts
// `formatCalendarDate` (no zone shift, whatever the machine's zone) instead of csps.ts `formatDate`; the text is the
// same ("Sep 28, 2026").
import clsx from 'clsx';
import type { Order, Totals } from '@/lib/csps';
import { formatCalendarDate } from '@/lib/format';
import { Button } from '@/ui/actions';
import { Icon, MediaPlaceholder } from '@/ui/brand';
import { OrderTotals } from '@/ui/money';
import { StatusBadge } from '@/ui/status';
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
  return (
    <article className={orderCardClasses}>
      <button type="button" className={orderMediaClasses} onClick={onView} aria-label={`View order ${o.number}`}>
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
            {images.length}
          </span>
        )}
      </button>
      <div className={orderBodyClasses}>
        <div className={orderHeadClasses}>
          <span className={orderNumberClasses}>{o.number}</span>
          <span className={orderQtyClasses}>{qty} pcs</span>
        </div>
        <h3 className={orderTeamClasses}>{o.team || o.customer}</h3>
        <p className={orderCustomerClasses}>{o.team ? o.customer : ''}</p>
        <div className={orderDatesClasses}>
          <span className={orderDateClasses}>
            <Icon name="calendar" size={14} />
            {formatCalendarDate(o.orderDate)}
          </span>
          <span className={clsx(orderDateClasses, o.overdue && orderOverdueClasses)}>
            <Icon name="clock" size={14} />
            Due {formatCalendarDate(o.dueDate)}
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
