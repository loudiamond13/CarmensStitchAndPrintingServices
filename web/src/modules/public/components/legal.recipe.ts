// SPEC-GAP: the legal page looks (UI-SPEC L1) as complete Tailwind tokens (D-33): no CSS file, no @apply.
import { tw } from '@/ui/tw';

/** The DRAFT notice: a warning box, 16px padding, 8px between the icon and the text. */
export const noticeClasses = tw(
  'flex max-w-[640px] items-start gap-2 rounded-md border border-warning bg-warning-soft p-4',
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

/** The article text column: at most 640px, and long words and pasted URLs wrap. */
export const articleClasses = tw('max-w-[640px] min-w-0 wrap-anywhere');

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

/** LegalFacts: the business and the contact lines, 8px apart. */
export const factsClasses = tw('flex flex-col gap-2');

/** The business address: Small, muted. */
export const factsAddressClasses = tw('text-14 leading-5 text-ink-muted');

/** The contact lines: a list of 44px rows. */
export const contactListClasses = tw('flex flex-col');

/** One contact line: a label and its link on a row that is at least 44px tall. */
export const contactLineClasses = tw('flex min-h-11 flex-wrap items-center gap-x-1 text-14 leading-5 text-ink');
