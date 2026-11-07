// The dashboard's looks as complete Tailwind tokens (D-33; plan 10-07). Every string here is a class list.
import { tw } from '@/ui/tw';

/** `.s-ph-actions`: the header buttons in a row 8px apart; on phones they take the full width, each growing equally (App. C). */
export const dashboardHeadActionsClasses = tw('flex flex-wrap items-center gap-2 pg-phone:w-full pg-phone:*:flex-1');

/** The h1 wraps anywhere, so a very long first name is never cut off. */
export const dashboardTitleClasses = tw('wrap-anywhere');
