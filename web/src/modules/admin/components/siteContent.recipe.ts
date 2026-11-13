// The Site Content looks (UI-SPEC S0 and S1; plan 11-12) as complete Tailwind tokens (D-33). The cards themselves reuse the My Profile
// card recipes (`.s-card`, `.s-card-h`, `.s-card-b`); only what those do not give is here. No new token.
import { tw } from '@/ui/tw';

/** The cards of one tab: a column, 24px apart (S1 "24px between cards"). */
export const siteContentStackClasses = tw('flex min-w-0 flex-col gap-6');

/** The Undo Changes and Save buttons at the end of a tab's panel: a wrapping row on the right, 12px apart. */
export const siteContentActionsClasses = tw('flex flex-wrap items-center justify-end gap-3');

/**
 * One phone row (D-23): Number, Label, the Main number radio and Remove on a line (`1fr 160px auto 44px`). On phones the two fields
 * stack and the radio and Remove share the last line.
 */
export const phoneRowClasses = tw(
  'grid grid-cols-[minmax(0,1fr)_160px_auto_44px] items-start gap-x-4 gap-y-3 pg-phone:grid-cols-[minmax(0,1fr)_44px]',
);

/** The Number and Label cells fill the phone row. */
export const phoneFieldCellClasses = tw('min-w-0 pg-phone:col-span-2');

/** The radio and Remove cells line up with the control of the fields beside them (the label above is 26px tall). */
export const phoneControlCellClasses = tw('flex items-center pt-[26px] pg-phone:pt-0');

/** The rows and the Add Number button under them: a column 16px apart. */
export const phoneListClasses = tw('flex flex-col gap-4');

/** The seven day rows of the hours card: a column 12px apart. */
export const hoursListClasses = tw('flex flex-col gap-3');

/**
 * One day row (S2 card A): the day column 160px, then Opens and Closes at one share each. On phones the day sits on top and the two
 * selects side by side under it.
 */
export const hoursRowClasses = tw(
  'grid grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)] items-end gap-x-4 gap-y-2 pg-phone:grid-cols-2',
);

/** The day checkbox, as tall as a select so the row lines up; on phones it takes the whole top line. */
export const hoursDayCellClasses = tw('flex min-h-11 min-w-0 items-center pg-phone:col-span-2');

/** The word Closed that stands in place of the two selects. */
export const hoursClosedCellClasses = tw('col-span-2 flex min-h-11 items-center text-[14px] text-ink-muted');

/** The "Visitors see" lines under the rows (14px muted). */
export const hoursPreviewClasses = tw('flex flex-col gap-0.5 text-[14px] leading-5 text-ink-muted');

// ---- Products tab and product line editor (S3, S4; plan 11-20) ----

/** The lead cell of the product line table: the 44px photo, then the title over the short name. */
export const lineCellClasses = tw('flex min-w-0 items-center gap-3');

/** The row actions of a product line: on a phone the cell is a full-width row under the other cells, and the buttons sit at its end. */
export const lineActionsClasses = tw('pg-phone:ml-auto');

/** The 44 x 44 main photo, or its placeholder. */
export const lineThumbClasses = tw('size-11 shrink-0 overflow-hidden rounded-sm bg-surface-2');

/** The title and the short name under it. */
export const lineTextClasses = tw('flex min-w-0 flex-col');

/**
 * The title as a link to the editor (`--accent-ink`). It is at least 24px tall and as wide as its text, so the link is a big enough target
 * (WCAG 2.5.8) beside the short name under it; the 44px tap area comes from the hit area class.
 */
export const lineTitleLinkClasses = tw(
  'inline-flex min-h-6 items-center self-start font-semibold wrap-anywhere text-accent-ink hover:underline hover:underline-offset-4',
);

/** A link inside a sentence (`--accent-ink`): it keeps the line of the text around it. */
export const lineInlineLinkClasses = tw('font-semibold text-accent-ink hover:underline hover:underline-offset-4');

/** The short name under the title (12px muted). */
export const lineShortNameClasses = tw('text-[12px] leading-4 text-ink-muted');

/** The price over the minimum, end-aligned like every money cell. */
export const linePriceCellClasses = tw('flex flex-col items-end');

/** "min. 10 pcs" under the price. */
export const linePriceMinimumClasses = tw('text-[12px] leading-4 font-normal text-ink-muted');

/** The three photo slots of a line: a row from a tablet up (D-02), one column on a phone (767px and below). */
export const lineSlotsClasses = tw('grid grid-cols-1 gap-6 min-[768px]:grid-cols-3');

/** One customize field's label: the 18px icon and the card title. */
export const lineCustomizeLabelClasses = tw('inline-flex items-center gap-2');

/** The order product type checklist: a fieldset with no border, the boxes 12px apart. */
export const lineTypesFieldsetClasses = tw('m-0 flex min-w-0 flex-col gap-3 border-0 p-0');

/** The checklist's legend: the field label look (14px 600). */
export const lineTypesLegendClasses = tw('mb-3 p-0 text-[14px] leading-5 font-semibold text-ink');

/** The line under the checklist, and the note when there are no product types (14px muted). */
export const lineTypesHintClasses = tw('m-0 text-[14px] leading-5 text-ink-muted');

/** " (now under Volleyball Jerseys)" after a type's name (muted). */
export const lineTypeNoteClasses = tw('text-[12px] leading-4 font-normal text-ink-muted');

// ---- Testimonials tab (S5; plan 11-24) ----

/** The quote cell: small text clamped to two lines, a long word breaks anywhere. The whole quote is in the edit window. */
export const testimonialQuoteClasses = tw('line-clamp-2 text-[13px] leading-5 wrap-anywhere');

/** The name over the team or role. */
export const testimonialPersonClasses = tw('flex min-w-0 flex-col');

/** The person's name (the label look). */
export const testimonialNameClasses = tw('text-[14px] leading-5 font-semibold wrap-anywhere');

/** The team or role under the name (12px muted). */
export const testimonialTeamClasses = tw('text-[12px] leading-4 wrap-anywhere text-ink-muted');

/** The stars cell: the one star, then "5 stars". */
export const testimonialStarsClasses = tw('inline-flex items-center gap-1.5');

/** The one decorative star, filled in the orange ink. */
export const testimonialStarClasses = tw('shrink-0 fill-current text-accent-ink');

/** The status cell: the badge, and "On the Home page" under it. */
export const testimonialStatusClasses = tw('flex flex-col items-start gap-1');

/** "On the Home page" under the badge (12px muted). */
export const testimonialHomeNoteClasses = tw('text-[12px] leading-4 text-ink-muted');

// ---- Gallery tab (S6; plan 11-32) ----

/** The 56 x 56 cover of a gallery item, or its placeholder. */
export const galleryThumbClasses = tw('size-14 shrink-0 overflow-hidden rounded-sm bg-surface-2');

/** The name over "{Basketball} · {17} pcs" beside the thumb: it may wrap but never widens the cell. */
export const galleryNameClasses = tw('text-[14px] leading-5 font-semibold wrap-anywhere');

/** The order number as a link to the order (`--accent-ink`), at least 24px tall (WCAG 2.5.8). */
export const galleryOrderLinkClasses = tw(
  'inline-flex min-h-6 items-center font-semibold text-accent-ink hover:underline hover:underline-offset-4',
);

/** The status cell: the badge, and "Line hidden" under it. */
export const galleryStatusClasses = tw('flex flex-col items-start gap-1');
