// The Component Showcase looks (D-22, UI-SPEC "Phase 2 pages" → ComponentShowcase, C1).
// The showcase adds no type values of its own: sections take the App. C `.s-card` / `.s-card-h` / `.s-card-b` looks,
// group headings the `.s-card-h h2` look, variant labels the `.csp-overline` look (overlineClasses) and icon names the
// `.csp-label` look (labelClasses). Every string here is a class list (the class gate compiles each one).
import clsx from 'clsx';
import { cardClasses, labelClasses } from '@/components';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import { tw } from '@/ui/tw';

/** The h1 and its "Demo data" badge in one wrapping row, 10px apart (as the Users title row). */
export const titleRowClasses = tw('flex flex-wrap items-center gap-2.5');

/** `.s-card`: one section per group. */
export const sectionClasses = clsx(cardClasses, tw('min-w-0'));

/** `.s-card-h`: the section head, 16 20 with a `--line` rule under it. */
export const sectionHeadClasses = tw(
  'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
);

/** `.s-card-h h2`: display 700 at 22px, line height 1.1. */
export const sectionTitleClasses = tw('font-display text-[22px] leading-[1.1] font-bold');

/** `.s-card-b` (padding 20) holding the cases one under the other, 24px apart. */
export const sectionBodyClasses = tw('flex flex-col gap-6 p-5');

/** One case: its overline label over its frame. */
export const caseClasses = tw('flex min-w-0 flex-col gap-2');

/**
 * The `[data-case]` frame of a rendered case (L-29): a page root (the `.s-page` look and the `pg` container, so the
 * case reads its own width) as wide as the section body, never as wide as its content. A case wider than the frame
 * scrolls inside it, so no case widens the page; the 16px inset keeps focus rings and shadows inside the scrollport.
 * The frame is a focusable region, so it gets the 2px focus ring with its 2px offset when it has keyboard focus.
 */
export const frameClasses = clsx(
  pageRootClasses,
  tw('w-full overflow-x-auto p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'),
);

/**
 * The `[data-case]` frame of a live demo (a trigger that opens a dialog or the drawer): no page root, so the fixed
 * layer the demo opens takes the admin shell's page root as its containing block and covers the page.
 */
export const demoFrameClasses = tw('flex flex-wrap items-center gap-3');

/** The 56 icons with their names, in as many 160px columns as fit. */
export const iconGridClasses = tw('m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-0');

/** One icon and its name. */
export const iconCellClasses = tw('flex min-w-0 items-center gap-2');

/** An icon's name in the `.csp-label` look; a long name wraps inside its column. */
export const iconNameClasses = clsx(labelClasses, tw('min-w-0 wrap-anywhere'));

/** The toast triggers in one wrapping row. */
export const triggersClasses = tw('flex flex-wrap items-center gap-3');

/** The loaded LazyImage: 240px wide (the frame is far wider), never wider than the frame. */
export const loadedImageClasses = tw('w-60 max-w-full');

/** The formatted dates: term over value, side by side. */
export const datesClasses = tw('m-0 flex flex-wrap gap-6');

/** One date: its overline term over the value. */
export const dateClasses = tw('flex flex-col gap-1');

/** The Staff and audit demos, one case under another (each case keeps its own label and frame). */
export const staffStackClasses = tw('flex w-full min-w-0 flex-col gap-6');

/** The Phase 8 order cards side by side, wrapping on a narrow page. */
export const orderCardsGridClasses = tw('grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5');

/** The Phase 8 totals panels side by side, wrapping on a narrow page. */
export const orderTotalsGridClasses = tw('grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5');

/** The Change Status menu drawn open in place (no pop-in, so the page-wide opacity rule sees it settled): the real popover's look without its position. */
export const statusMenuStaticClasses = tw(
  'flex max-w-full min-w-[240px] flex-col gap-0.5 rounded-md bg-surface-3 p-2 shadow-level-2',
);

/** One due flag case: the status in words, then the flag as the order screens draw it. */
export const dueCaseClasses = tw('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[14px]');

/** The due flag cases, one under another. */
export const dueListClasses = tw('m-0 flex list-none flex-col gap-2 p-0');

/** The status badges in one wrapping row. */
export const badgesRowClasses = tw('flex flex-wrap items-center gap-3');

/** The banners, one under another. */
export const bannersStackClasses = tw('flex w-full min-w-0 flex-col gap-4');

/** The status menu demo: the button, then the open menu under it. */
export const statusMenuColumnClasses = tw('flex min-w-0 flex-col items-start gap-1');
