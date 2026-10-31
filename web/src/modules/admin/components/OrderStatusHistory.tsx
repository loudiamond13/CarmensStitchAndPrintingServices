// The status history card of the order page (UI-SPEC O1 Side 3; D-17, D-50; plan 08-12): a list newest first, each row "{From} to
// {To}" over "{name} · {date}" ("System" when no person made the change, "Created as {Status}" for the first row). It shows the
// newest 5; Show All expands it in place and the same button, now Show Fewer, keeps the focus. Text only (CWE-79).
import { useState } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { ActorName } from '@/components/data';
import { isOrderStatus } from '@/components/status';
import {
  orderCardHeadClasses,
  orderCardTitleClasses,
  orderCardTitleRowClasses,
  orderCardBodyClasses,
  orderHistoryCardClasses,
  orderHistoryListClasses,
  orderHistoryMoreClasses,
  orderHistorySubClasses,
  orderHistoryTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { ORDER_STATUSES } from '@/utils/csps';
import { formatBusinessDate } from '@/utils/format';

const COPY = ORDER_PAGE_COPY.history;
const TITLE_ID = 'order-history';
const LIST_ID = 'order-history-list';
/** How many rows show before Show All (D-50). */
const COLLAPSED_ROWS = 5;

type StatusChange = OrderDetailResponse['statusHistory'][number];

/** The label of a status key; a key the types do not know shows as sent. */
function statusLabel(key: string): string {
  return isOrderStatus(key) ? ORDER_STATUSES[key] : key;
}

function rowTitle(change: StatusChange): string {
  return change.from === null
    ? COPY.createdAs(statusLabel(change.to))
    : COPY.move(statusLabel(change.from), statusLabel(change.to));
}

export interface OrderStatusHistoryProps {
  /** The history as the server sends it, oldest first. */
  history: OrderDetailResponse['statusHistory'];
}

export function OrderStatusHistory({ history }: OrderStatusHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const newestFirst = [...history].reverse();
  const shown = expanded ? newestFirst : newestFirst.slice(0, COLLAPSED_ROWS);
  const canFold = newestFirst.length > COLLAPSED_ROWS;
  return (
    <section className={orderHistoryCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <div className={orderCardTitleRowClasses}>
          <Icon name="history" size={20} />
          <h2 id={TITLE_ID} className={orderCardTitleClasses}>
            {COPY.title}
          </h2>
        </div>
      </div>
      <div className={orderCardBodyClasses}>
        <ol id={LIST_ID} className={orderHistoryListClasses}>
          {shown.map((change) => (
            <li key={`${change.changedAt}-${change.from ?? ''}-${change.to}`}>
              <span className={orderHistoryTitleClasses}>{rowTitle(change)}</span>
              <span className={orderHistorySubClasses}>
                <ActorName actor={change.changedBy} />
                {COPY.separator}
                <time dateTime={change.changedAt}>{formatBusinessDate(change.changedAt) ?? change.changedAt}</time>
              </span>
            </li>
          ))}
        </ol>
        {canFold && (
          <div className={orderHistoryMoreClasses}>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={LIST_ID}
              onClick={() => {
                setExpanded((open) => !open);
              }}
            >
              {expanded ? COPY.showFewer : COPY.showAll(newestFirst.length)}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
