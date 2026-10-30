// The 7px dot before a status in the Change Status menu and the Reopen window: the ink of that status's badge. Hidden from
// assistive technology, because the status words carry the meaning (UI-SPEC O1 OrderStatusMenu).
import clsx from 'clsx';
import { isOrderStatus, STATUS_TONE } from '@/components/status';
import { orderStatusDotClasses, orderStatusDotToneClasses } from '@/modules/admin/components/orderPage.recipe';

export function OrderStatusDot({ status }: { status: string }) {
  const tone = isOrderStatus(status) ? STATUS_TONE[status] : 'neutral';
  return <span className={clsx(orderStatusDotClasses, orderStatusDotToneClasses[tone])} aria-hidden="true" />;
}
