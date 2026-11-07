// The dashboard's looks as complete Tailwind tokens (D-33; plans 10-07 and 10-09). Every string here is a class list.
import { tw } from '@/ui/tw';

/** `.s-ph-actions`: the header buttons in a row 8px apart; on phones they take the full width, each growing equally (App. C). */
export const dashboardHeadActionsClasses = tw('flex flex-wrap items-center gap-2 pg-phone:w-full pg-phone:*:flex-1');

/** The h1 wraps anywhere, so a very long first name is never cut off. */
export const dashboardTitleClasses = tw('wrap-anywhere');

/** `.s-kpis`: four columns, 2 x 2 up to 1023px; on phones a 12px gap, 16px card padding and no icon tile (App. C). */
export const dashboardKpiRowClasses = tw(
  'grid grid-cols-[repeat(4,minmax(0,1fr))] gap-4 pg-phone:gap-3 pg-phone:*:p-4 pg-lt-lg:grid-cols-[repeat(2,minmax(0,1fr))] pg-phone:[&_.size-8]:hidden',
);
