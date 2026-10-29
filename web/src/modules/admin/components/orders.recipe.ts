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
