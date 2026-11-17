// The cookie bar look (UI-SPEC CB1; ANL-01, D-16) as complete Tailwind tokens (D-33): no CSS file, no @apply. `pg-phone:` is
// the 767px container rule. Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

// SPEC-GAP: CB1 has no App. C look; this follows the UI-SPEC Look paragraph: --surface-3 ground, a 1px --line rule on top
// (a shadow, so it takes no height and the bar stays within --spacing-consent-bar), --shadow-3, z-index --z-header.
/** The fixed bar: full width at the bottom of the viewport; 16px above and below plus the device safe area. */
export const barClasses = tw(
  'fixed inset-x-0 bottom-0 z-(--z-header) bg-surface-3 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] [box-shadow:0_-1px_0_var(--line),var(--shadow-3)]',
);

/** `.s-wrap`: the text left and the buttons right in one row; stacked at 767px and below, 16px apart. */
export const innerClasses = tw(
  'mx-auto flex max-w-(--container-max) items-center gap-4 px-6 pg-phone:flex-col pg-phone:items-stretch pg-phone:px-4',
);

/** Small text, up to three lines. */
export const textClasses = tw('min-w-0 flex-1 text-14 leading-5 text-ink');

/** "Cookie Policy": same tab, underlined. */
export const policyLinkClasses = tw('font-semibold text-ink underline underline-offset-4');

/** The three buttons, 8px apart: one row, or a two-column grid on phones. */
export const buttonsClasses = tw('flex flex-none items-center gap-2 pg-phone:grid pg-phone:grid-cols-2');

// SPEC-GAP: CB1 Reject All and Accept All share one class string, so variant, size, width and weight cannot differ (D-16).
/** Reject All and Accept All: the same width (wide), equal halves (phone). */
export const choiceClasses = tw('w-32 pg-phone:w-full');

/** CS1: the description (Body 16/24, muted) and the Cookie Policy link under it, 44px tall. */
export const descriptionClasses = tw('m-0 text-16 leading-6 text-ink-muted');
export const windowLinkClasses = tw(
  'inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4',
);

/** CS1: Small muted lines (the saved-choice line, the Necessary hint). */
export const smallMutedClasses = tw('m-0 text-14 leading-5 text-ink-muted');

/** CS1: the Necessary title (a Label) and its badge on one line. */
export const necessaryHeadClasses = tw(
  'mb-1 flex flex-wrap items-center gap-2 text-14 leading-5 font-semibold text-ink',
);

/** CS1: the choices fieldset, rows 16px apart; the legend is a Label. */
export const fieldsetClasses = tw('m-0 flex min-w-0 flex-col gap-4 border-0 p-0');
export const legendClasses = tw('mb-4 p-0 text-14 leading-5 font-semibold text-ink');

/** Cookie Settings: first in the DOM; full width under the two choices on phones. */
export const settingsClasses = tw('pg-phone:order-last pg-phone:col-span-2 pg-phone:w-full');
