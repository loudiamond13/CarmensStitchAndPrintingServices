// SPEC-GAP: the legal page looks (UI-SPEC L1) as complete Tailwind tokens (D-33): no CSS file, no @apply.
import { tw } from '@/ui/tw';

/** The DRAFT notice: a warning box, 16px padding, 8px between the icon and the text. */
export const noticeClasses = tw(
  'flex max-w-reading items-start gap-2 rounded-md border border-warning bg-warning-soft p-4',
);

/** The notice icon, level with the first line. */
export const noticeIconClasses = tw('mt-px text-warning');

/** The notice's Label line. */
export const noticeLabelClasses = tw('text-14 leading-5 font-semibold text-ink');

/** The notice's Small line. */
export const noticeSmallClasses = tw('text-14 leading-5 text-ink-muted');

/** The version line under the h1: Small, muted. */
export const versionLineClasses = tw('text-14 leading-5 text-ink-muted');

/** The article area under the page head: the `.s-wrap` column, 32px under the head and 48px at the bottom. */
export const articleAreaClasses = tw('mx-auto w-full max-w-(--container-max) px-6 pt-8 pb-12 pg-phone:px-4');

/** The two columns from 1024px: a 240px table of contents and a 640px article, 64px apart; one column below that, 32px apart. */
export const articleGridClasses = tw(
  'grid grid-cols-[240px_minmax(0,var(--spacing-reading))] items-start gap-16 pg-lt-lg:grid-cols-[minmax(0,1fr)] pg-lt-lg:gap-8',
);

/**
 * The wide table of contents: its links stick 24px under the header, and it scrolls when it is taller than the window below
 * that. The 4px padding keeps the focus ring inside the scroll box; the -4px margin and top keep the links where they were.
 * Hidden at 1023px and below.
 */
export const tocWideClasses = tw(
  'sticky top-[calc(var(--header-height)+var(--space-6)-var(--space-1))] -m-1 max-h-[calc(100dvh-var(--header-height)-var(--space-6)+var(--space-1))] overflow-y-auto overscroll-contain p-1 pg-lt-lg:hidden',
);

/** The phone table of contents box: closed by default, `--surface` ground, 1px line border; hidden at 1024px and above. */
export const tocBoxClasses = tw('group hidden rounded-md border border-line bg-surface pg-lt-lg:block');

/** The box's summary: a 44px Label row with the chevron at the end; the browser marker is hidden. */
export const tocSummaryClasses = tw(
  'flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-14 leading-5 font-semibold text-ink [&::-webkit-details-marker]:hidden',
);

/** The summary chevron: turns when the box opens, and not under reduced motion. */
export const tocChevronClasses = tw(
  'transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none',
);

/** The links inside the phone box: 16px of padding at the sides. */
export const tocBoxLinksClasses = tw('px-4 pb-2');

/** The table of contents links: a list with 8px between the 44px links. */
export const tocListClasses = tw('flex flex-col gap-2');

/** One table of contents link: Small, 44px tall. */
export const tocLinkClasses = tw(
  'flex min-h-11 items-center text-14 leading-5 text-ink no-underline hover:text-link hover:underline hover:underline-offset-4',
);

/** The article text column: at most 640px, and long words and pasted URLs wrap. */
export const articleClasses = tw('max-w-reading min-w-0 wrap-anywhere');

/** One section: 48px above each one after the first. The header scroll padding clears a jump to its heading. */
export const sectionClasses = tw('mt-12 first:mt-0');

/** The section's h2: the display-sm look, 16px above its first block. */
export const sectionHeadingClasses = tw('mb-4 font-display text-22 leading-[1.1] font-bold text-ink');

/** The blocks of a section, 16px apart. */
export const blocksClasses = tw('flex flex-col gap-4');

/** Body text: 16/24. */
export const bodyClasses = tw('text-16 leading-6 text-ink');

/** A bulleted list: disc markers, 24px left padding, 8px between items. */
export const listClasses = tw('flex list-disc flex-col gap-2 pl-6 text-16 leading-6 text-ink');

/** A term list: 16px between items. */
export const termListClasses = tw('flex flex-col gap-4');

/** A term (`dt`) and a heading (`h3`): the Label look. */
export const labelClasses = tw('text-14 leading-5 font-semibold text-ink');

/** A description (`dd`): Body. */
export const descriptionClasses = tw('m-0 text-16 leading-6 text-ink');

/** A link inside text: the link color, underlined. */
export const inlineLinkClasses = tw('text-link underline underline-offset-[3px]');

/** LegalFacts: the business and the contact lines, 8px apart; long names, addresses and emails wrap. */
export const factsClasses = tw('flex min-w-0 flex-col gap-2 wrap-anywhere');

/** The business address: Small, muted. */
export const factsAddressClasses = tw('text-14 leading-5 text-ink-muted');

/** The contact lines: a list of 44px rows. */
export const contactListClasses = tw('flex flex-col');

/** One contact line: a label and its link on a row that is at least 44px tall. */
export const contactLineClasses = tw('flex min-h-11 flex-wrap items-center gap-x-1 text-14 leading-5 text-ink');
