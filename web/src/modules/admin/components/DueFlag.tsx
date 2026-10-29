// The due date and its flag (ORD-11, D-36 to D-38). `today` is the server's business date, never the device clock (D-59).
import { Icon } from '@/components/brand';
import { EmptyValue } from '@/components/states';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import { dueFlagState } from '@/utils/dueFlag';
import { formatCalendarDate } from '@/utils/format';
import {
  dueFlagDateClasses,
  dueFlagDaysLeftClasses,
  dueFlagInlineClasses,
  dueFlagOverdueClasses,
  dueFlagSoonClasses,
  dueFlagStackedClasses,
} from './orders.recipe';

export interface DueFlagProps {
  /** The due date as YYYY-MM-DD, or null for an imported order without one. */
  dueDate: string | null;
  status: string;
  /** The business date from the server response (D-59). */
  today: string;
  /** `stacked` puts the flag under the date (table); `inline` joins them with a dot (cards, subline). */
  layout?: 'inline' | 'stacked';
}

const COPY = ORDERS_COPY.due;

export function DueFlag({ dueDate, status, today, layout = 'inline' }: DueFlagProps) {
  const state = dueFlagState(today, dueDate, status);
  const formatted = dueDate === null ? null : formatCalendarDate(dueDate);

  const date =
    formatted === null ? (
      <span className={dueFlagDateClasses}>
        {COPY.label} <EmptyValue />
      </span>
    ) : (
      <span className={dueFlagDateClasses}>{COPY.date(formatted)}</span>
    );

  let flag = null;
  switch (state.kind) {
    case 'days-left':
      flag = <span className={dueFlagDaysLeftClasses}>{COPY.daysLeft(state.days)}</span>;
      break;
    case 'tomorrow':
      flag = <span className={dueFlagSoonClasses}>{COPY.tomorrow}</span>;
      break;
    case 'today':
      flag = <span className={dueFlagSoonClasses}>{COPY.today}</span>;
      break;
    case 'overdue':
      flag = (
        <span className={dueFlagOverdueClasses}>
          <Icon name="triangle-alert" size={14} />
          <span>{COPY.overdue(state.days)}</span>
        </span>
      );
      break;
    default:
      break;
  }

  if (layout === 'stacked') {
    return (
      <span className={dueFlagStackedClasses}>
        {date}
        {flag}
      </span>
    );
  }
  return (
    <span className={dueFlagInlineClasses}>
      {date}
      {flag !== null && (
        <>
          <span aria-hidden="true" className={dueFlagDateClasses}>
            {COPY.separator}
          </span>
          {flag}
        </>
      )}
    </span>
  );
}
