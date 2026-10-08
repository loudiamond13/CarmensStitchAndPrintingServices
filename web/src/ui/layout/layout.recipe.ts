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
