// The hours card looks (UI-SPEC C1; App. C `.s-hours`, `.s-open`) as complete Tailwind tokens (D-33). They live apart from
// contact.recipe.ts so the lazy hours card is the only chunk that carries them.
import { tw } from '@/ui/tw';

/** The head row: the title and the pill on one line, the status line wrapping under them. */
export const hoursHeadClasses = tw('flex flex-wrap items-center justify-between gap-x-3 gap-y-2');

/** `.s-open`: 12px bold with an 8px dot, 6px apart, in the success color for "Open now". */
export const openPillClasses = tw(
  'inline-flex items-center gap-[6px] text-[12px] leading-4 font-bold text-success before:size-2 before:rounded-full before:bg-current',
);

/** "Closed now": the `.s-open` look in the muted ink. */
export const closedPillClasses = tw(
  'inline-flex items-center gap-[6px] text-[12px] leading-4 font-bold text-ink-muted before:size-2 before:rounded-full before:bg-current',
);

/** The Small status line under the head row. */
export const statusLineClasses = tw('basis-full text-[14px] leading-5');

/** `.s-hours`: the days on the left and the hours on the right, 6px and 16px apart. */
export const hoursListClasses = tw('grid grid-cols-[1fr_auto] gap-x-4 gap-y-[6px] text-[14px] leading-5');

/** `.s-hours dt`. */
export const hoursDayClasses = tw('text-ink-muted');

/** `.s-hours dd`: semi-bold, tabular figures, right aligned. */
export const hoursTimeClasses = tw('text-right font-semibold [font-variant-numeric:tabular-nums]');

/** The "Closed on" block: the label over its rows. */
export const closuresBlockClasses = tw('flex flex-col gap-2');

/** The closure rows; a long note wraps and never cuts off. */
export const closuresListClasses = tw('flex flex-col gap-1 text-[14px] leading-5 wrap-anywhere');
