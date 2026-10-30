// A notice under an order header (UI-SPEC X2; plan 08-23): the locked-banner look with any icon, a bold line, a muted line and an
// action area at the end. The deleted order view uses it for who deleted the order, with Restore and Delete Permanently. Full width
// actions on phones. The title may be parts (text and a name), never HTML.
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/brand';
import {
  orderLockedBannerClasses,
  orderLockedTextClasses,
  orderNoticeActionsClasses,
} from '@/modules/admin/components/orderPage.recipe';

export interface OrderNoticeBannerProps {
  icon: IconName;
  /** The bold first line. */
  title: ReactNode;
  /** The muted second line. */
  message: string;
  /** The actions after the text. */
  children?: ReactNode;
}

export function OrderNoticeBanner({ icon, title, message, children }: OrderNoticeBannerProps) {
  return (
    <div className={orderLockedBannerClasses}>
      <Icon name={icon} size={20} />
      <div className={orderLockedTextClasses}>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {children !== undefined && <div className={orderNoticeActionsClasses}>{children}</div>}
    </div>
  );
}
