// The order screens' looks as complete Tailwind tokens (D-33; plan 08-05). Every string here is a class list.
import { tw } from '@/ui/tw';

/** The due date and its flag in one line of text that wraps after the dot (cards, the order subline). */
export const dueFlagInlineClasses = tw('inline');

/** The due date over its flag, 4px apart (table cell). */
export const dueFlagStackedClasses = tw('flex flex-col items-start gap-1');

/** The date, and the "Due" label when there is no date: muted ink. */
export const dueFlagDateClasses = tw('text-[14px] leading-5 text-ink-muted');

/** Days left: Small 14/400 muted. */
export const dueFlagDaysLeftClasses = tw('text-[14px] leading-5 text-ink-muted');

/** Due today and tomorrow: Label 14/600 ink. */
export const dueFlagSoonClasses = tw('text-[14px] leading-5 font-semibold text-ink');

/** Overdue: Label 14/600 danger, the icon beside the words (D-36). */
export const dueFlagOverdueClasses = tw(
  'inline-flex items-center gap-1 text-[14px] leading-5 font-semibold text-danger',
);

/**
 * The order grid (`.s-orders`): four columns, three up to 1279px, two on tablets, one on phones, 20px apart. The page
 * container variants are emitted widest first, so the narrower rules are important and the tablet and phone rules do not overlap.
 * While the next page loads (`data-refetching`) the cards dim to --surface-2 by colour only (D-02, UI-SPEC "refetch").
 */
export const ordersGridClasses = tw(
  'grid grid-cols-[repeat(4,minmax(0,1fr))] gap-5 pg-phone:grid-cols-[minmax(0,1fr)]! pg-tablet:grid-cols-[repeat(2,minmax(0,1fr))]! pg-lt-xl:grid-cols-[repeat(3,minmax(0,1fr))] data-[refetching=true]:[&_article]:bg-surface-2',
);

/** The one-line subline skeleton while the counts load: a fixed width, so the header does not jump. */
export const ordersSublineSkeletonClasses = tw('w-[220px] max-w-full');

/** The custom order date range (From and To) on its own row of the toolbar (UI-SPEC L1 toolbar). */
export const ordersCustomRangeClasses = tw('flex basis-full flex-wrap items-end gap-3');

/** The balance box, as tall as the 40px controls beside it and bottom-aligned with them. */
export const ordersBalanceFilterClasses = tw('flex min-h-10 items-center');
