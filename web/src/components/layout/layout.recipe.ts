// Shared layout looks (D-33, WEB-02). Complete class literals only; the class gate compiles every string here.
import { tw } from '@/ui/tw';

/**
 * Visually hidden text: the App. B `.csp-sr` look (`position: absolute; width: 1px; height: 1px; overflow: hidden;
 * clip: rect(0 0 0 0); white-space: nowrap`). Used instead of Tailwind's own visually-hidden utility, which sets more
 * properties, so computed styles match the reference (UI-SPEC "Class-name hooks policy").
 */
export const srOnlyClasses = tw('absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]');

/**
 * The page root: the App. C `.s-page` look (`container: pg / inline-size; position: relative; min-height: 100%;
 * background: var(--bg); color: var(--ink); font-family: var(--font-sans); font-size: 16px; line-height: 24px`).
 * The `pg-*` variants need this container as an ancestor.
 */
export const pageRootClasses = tw('@container/pg relative min-h-full bg-bg font-sans text-[16px] leading-6 text-ink');

// ── Page header (App. C `.s-ph`, spec §8.1; plan 02-31) ──
// The tablet and phone sizes are App. C's two container rules, kept as two variants with the same query text: between
// 767 and 768 px (and 1023 and 1024 px) neither rule applies in the approved CSS, so neither may apply here (WEB-05).

/** `.s-ph`: the title block and the actions in one wrapping row, aligned to the bottom (to the top on phones). */
export const pageHeadClasses = tw('flex flex-wrap items-end justify-between gap-4 pg-phone:items-start');

/** `.s-ph-title`: the h1 over its subline. */
export const pageHeadTitleClasses = tw('flex min-w-0 flex-col gap-1');

/** `.s-ph-title h1`: display 700 at 34px, 30px on tablets and phones. */
export const pageTitleClasses = tw(
  'font-display text-[34px] leading-[1.05] font-bold pg-phone:text-[30px] pg-tablet:text-[30px]',
);

/** `.s-ph-title p`: the 14px muted subline. */
export const pageSublineClasses = tw('text-[14px] leading-5 text-ink-muted');
