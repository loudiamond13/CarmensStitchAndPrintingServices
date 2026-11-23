// SPEC-GAP: quote requests inbox looks (UI-SPEC R1) as complete Tailwind tokens (D-33). Every string here is a class list.
import clsx from 'clsx';
import { hitAreaClasses } from '@/components/actions';
import { tw } from '@/ui/tw';

/** The Received cell: the date over the Small muted time. */
export const quoteReceivedClasses = tw('flex flex-col');

/** The time under the date. */
export const quoteReceivedTimeClasses = tw('text-[14px] leading-5 text-ink-muted');

/** The Name cell: the name link over the team. */
export const quoteWhoClasses = tw('flex min-w-0 flex-col items-start');

/** The name link to the request: Label (14px, 600), the one way into the request. */
export const quoteNameLinkClasses = clsx(
  tw('text-14 leading-5 font-semibold wrap-anywhere text-ink underline-offset-2 hover:underline'),
  hitAreaClasses,
);

/** The team under the name: Small muted. */
export const quoteTeamClasses = tw('text-[14px] leading-5 wrap-anywhere text-ink-muted');

/** The Photos cell: an optional warning icon before the count. */
export const quotePhotosClasses = tw('inline-flex items-center gap-1');

/** The warning icon of a request with missing photos. */
export const quotePhotosWarningClasses = tw('inline-flex text-warning');

/** The status pills row: 8px apart, wrapping at 320px and never scrolling sideways. */
export const quotePillsClasses = tw('flex flex-wrap gap-2');

/** A 44px pill (the Gallery `.s-pill` look); `relative` holds the hidden " requests" so it never widens the row. */
export const quotePillClasses = tw(
  'relative inline-flex min-h-11 flex-none cursor-pointer items-center gap-[6px] rounded-sm border px-4 text-14 whitespace-nowrap',
);

/** An unselected pill. */
export const quotePillOffClasses = tw(
  'border-line bg-surface font-semibold text-ink-muted hover:border-line-strong hover:text-ink',
);

/** The selected pill: maroon and bold, so orange is never the only cue. */
export const quotePillOnClasses = tw('border-primary bg-primary font-bold text-on-primary');

/** The pill count at full opacity. */
export const quotePillCountClasses = tw('tabular-nums');
