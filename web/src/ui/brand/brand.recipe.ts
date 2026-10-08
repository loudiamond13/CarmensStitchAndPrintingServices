// The brand looks (App. B `/* ── Logo ── */` and `.csp-mark`, CSPS-UI-SPEC.md §4) as complete Tailwind tokens (D-33).
// Every string in this file is a class list (the class gate reads them all). Axes set disjoint properties: the lockup
// gap and the letter and tagline font sizes live only in the size maps, never in the base lists.
import { tw } from '@/ui/tw';

export type LogoSize = 'sm' | 'md' | 'lg';

/** `.csp-mark`: `flex: none; display: block`. */
export const markClasses = tw('block flex-none');

/** `.csp-logo`: inline-flex, centred, `--ink`, no underline (the lockup sits in links). The gap is per size. */
export const logoClasses = tw('inline-flex items-center text-ink no-underline');

/** `.csp-logo-sm/md/lg { gap }` (App. B overrides the `.csp-logo` gap per size). */
export const logoGapClasses = {
  sm: tw('gap-3'),
  md: tw('gap-4'),
  lg: tw('gap-[22px]'),
} as const satisfies Record<LogoSize, string>;

/** `.csp-logo-<size> .csp-logo-word, .csp-logo-<size> .csp-logo-mark { font-size }`. */
export const logoLetterClasses = {
  sm: tw('text-[32px]'),
  md: tw('text-[50px]'),
  lg: tw('text-[92px]'),
} as const satisfies Record<LogoSize, string>;

/** `.csp-logo-<size> .csp-logo-tag { font-size }`. */
export const logoTaglineSizeClasses = {
  sm: tw('text-[9px]'),
  md: tw('text-[11px]'),
  lg: tw('text-[15px]'),
} as const satisfies Record<LogoSize, string>;

/** `.csp-logo-word`: the mark and "SPS" on one baseline row. */
export const logoWordClasses = tw('inline-flex items-end gap-[.06em]');

/** `.csp-logo-word .csp-logo-c`: the mark as the letter C, `.784em` square, raised `.15em`. */
export const logoLetterMarkClasses = tw('mb-[.15em] size-[.784em]');

/** `.csp-logo-mark`: Barlow Condensed 800 italic, tight, with room for the slash under it. */
export const logoLettersClasses = tw(
  'relative pb-[.14em] font-display leading-[.8] font-heavy tracking-[-.01em] italic',
);

/** `.csp-logo-slash`: the skewed orange underline bar. */
export const logoSlashClasses = tw(
  'absolute right-[-.02em] bottom-0 left-[.04em] h-[.085em] [transform:skewX(-18deg)] bg-accent',
);

/** `.csp-logo-tag` and its `::before` skewed slash. */
export const logoTaglineClasses = tw(
  "relative ml-[.2em] pl-[1.4em] font-sans leading-[1.32] font-bold tracking-[.16em] whitespace-nowrap text-ink uppercase before:absolute before:top-[-.35em] before:bottom-[-.35em] before:left-0 before:w-[.22em] before:[transform:skewX(-18deg)] before:bg-accent before:content-['']",
);
