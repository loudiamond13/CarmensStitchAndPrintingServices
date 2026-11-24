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

/** The selected pill: maroon at 600, so orange is never the only cue. */
export const quotePillOnClasses = tw('border-primary bg-primary font-semibold text-on-primary');

/** The pill count at full opacity. */
export const quotePillCountClasses = tw('tabular-nums');

// SPEC-GAP: quote request page looks (UI-SPEC R2).

/** The back link over the page head (4px, as `.s-ph-title`), or over the failure banner. */
export const quoteTopClasses = tw('flex flex-col gap-1');

/** The received line and the status badge in one wrapping row. */
export const quoteReceivedRowClasses = tw('flex flex-wrap items-center gap-x-3 gap-y-1');

/** The R2 h1: the `.s-ph-title h1` look; a long name wraps anywhere. */
export const quoteNameClasses = tw(
  'font-display text-[34px] leading-[1.05] font-bold wrap-anywhere text-ink focus:[outline:none] pg-phone:text-[30px] pg-tablet:text-[30px]',
);

/** The head actions: they wrap under the title below 1024px, each 44px tall. */
export const quoteActionsClasses = tw('flex flex-wrap items-center gap-2 pg-lt-lg:w-full');

/** Main column and a 360px aside, 24px apart, at 1024px and up; one column below. */
export const quoteDetailClasses = tw(
  'grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6 pg-lt-lg:grid-cols-[minmax(0,1fr)]!',
);

/** One column of cards, 24px apart. */
export const quoteColumnClasses = tw('flex min-w-0 flex-col gap-6');

/** The Request card list: a Label term over its Body value, 16px between pairs. */
export const quoteDetailsListClasses = tw('m-0 flex flex-col gap-4');

/** A term: Label (14px, 600). */
export const quoteTermClasses = tw('text-[14px] leading-5 font-semibold text-ink');

/** A value: Body (16px), wrapping anywhere. */
export const quoteValueClasses = tw('m-0 text-[16px] leading-6 wrap-anywhere text-ink');

/** The message keeps the visitor's line breaks. */
export const quoteMessageClasses = tw('whitespace-pre-wrap');

/** A tel: or mailto: value: a 44px tall link. */
export const quoteContactLinkClasses = tw('inline-flex min-h-11 items-center wrap-anywhere');

/** The photo tiles, 12px apart. */
export const quotePhotoListClasses = tw('m-0 grid list-none gap-3 p-0');

/** Small muted text: "No photos were sent.", the history dates. */
export const quoteMutedClasses = tw('m-0 text-[14px] leading-5 text-ink-muted');

/** The history list: Small rows, newest first, 12px apart. */
export const quoteHistoryListClasses = tw('m-0 flex list-none flex-col gap-3 p-0 text-[14px] leading-5 text-ink');

/** The Add a note box over its Add Note button, 12px apart. */
export const quoteNoteFormClasses = tw('flex flex-col items-start gap-3');

/** The Add a note box takes the card's width. */
export const quoteNoteFieldClasses = tw('self-stretch');

/** The notes, newest first, 16px apart. */
export const quoteNoteListClasses = tw('m-0 flex list-none flex-col gap-4 p-0');

/** A note's author: Label (14px, 600). */
export const quoteNoteAuthorClasses = tw('m-0 text-[14px] leading-5 font-semibold text-ink');

/** Delete Request with its Small muted reason under it when it cannot be used. */
export const quoteDeleteClasses = tw('flex flex-col items-start gap-1');
