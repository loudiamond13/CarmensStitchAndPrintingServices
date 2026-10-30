// The pieces every tab panel of the order page shares (UI-SPEC O1 Tab card; plan 08-12): the head with its title, caption and an
// action slot for the window plans, the inline empty line, the date cell and the person cell. Text only, never HTML (CWE-79).
import type { ReactNode, Ref } from 'react';
import { ExpenseActorCell } from '@/modules/admin/components/ExpenseActorCell';
import {
  orderCellStrongClasses,
  orderInlineEmptyClasses,
  orderTabCaptionClasses,
  orderTabHeadClasses,
  orderTabTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import type { ActorRef } from '@/modules/admin/services/expensesService';
import { formatCalendarDate } from '@/utils/format';

export interface OrderTabHeadProps {
  title: string;
  /** The caption under the title. */
  caption: ReactNode;
  /** The Add button of the window plans; nothing while the tab is read only. */
  action?: ReactNode;
  /** The h3 takes focus when a row is deleted and none is left to focus (plan 08-14). */
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}

export function OrderTabHead({ title, caption, action, headingRef }: OrderTabHeadProps) {
  return (
    <div className={orderTabHeadClasses}>
      <div>
        <h3 ref={headingRef} tabIndex={-1} className={orderTabTitleClasses}>
          {title}
        </h3>
        <p className={orderTabCaptionClasses}>{caption}</p>
      </div>
      {action}
    </div>
  );
}

/** `.s-inline-empty`: the line a tab shows when it has no rows. */
export function OrderTabEmpty({ children }: { children: ReactNode }) {
  return <div className={orderInlineEmptyClasses}>{children}</div>;
}

/** A calendar date as "Oct 3, 2026", bold. */
export function OrderDateCell({ date }: { date: string }) {
  return <strong className={orderCellStrongClasses}>{formatCalendarDate(date) ?? date}</strong>;
}

/** Avatar 24 and the name, with "(former staff)" for a deleted account and "System" for no person (D-12). */
export function OrderPersonCell({ person }: { person: ActorRef | null }) {
  return <ExpenseActorCell actor={person} />;
}
