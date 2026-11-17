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

/** The article area under the page head: the `.s-wrap` column. */
export const articleAreaClasses = tw('mx-auto w-full max-w-(--container-max) px-6 py-12 pg-phone:px-4');
