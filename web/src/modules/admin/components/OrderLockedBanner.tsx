// The locked-order banner (D-15; UI-SPEC O1 "Locked order"): a Completed or Cancelled order cannot be changed until it is
// reopened. A neutral banner with the lock icon, a bold line, a muted line (Cancelled adds the refunds line) and an action slot
// at the end: Back to Order on the Edit Order screen, Reopen Order on the order page (plan 08-19). Full width action on phones.
import type { ReactNode } from 'react';
import { Icon } from '@/components/brand';
import {
  orderLockedActionClasses,
  orderLockedBannerClasses,
  orderLockedTextClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';

const COPY = ORDER_PAGE_COPY.locked;

export interface OrderLockedBannerProps {
  status: 'completed' | 'cancelled';
  /** The action after the text. */
  children?: ReactNode;
}

export function OrderLockedBanner({ status, children }: OrderLockedBannerProps) {
  return (
    <div className={orderLockedBannerClasses}>
      <Icon name="lock" size={20} />
      <div className={orderLockedTextClasses}>
        <strong>{COPY.title(status)}</strong>
        <span>{COPY.reopen}</span>
        {status === 'cancelled' && <span>{COPY.refunds}</span>}
      </div>
      {children !== undefined && <div className={orderLockedActionClasses}>{children}</div>}
    </div>
  );
}
