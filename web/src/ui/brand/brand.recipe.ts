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

// ── Motifs (App. B "texture + motif utilities" and `/* ── Media placeholder ── */`, spec §5) ──

export type SectionCutTone = 'surface' | 'accent';

/** `.csp-mesh`: the 6px grid of 1px dots in `--ink` at 9%. */
export const meshClasses = tw(
  'bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);

/** `.csp-stitch-divider` and its two `::before`/`::after` stitched rules (`--line-strong`, 8px on, 6px off). */
export const stitchDividerClasses = tw(
  "flex items-center gap-3 text-ink-muted before:h-0.5 before:flex-1 before:bg-[image:repeating-linear-gradient(90deg,var(--line-strong)_0_8px,transparent_8px_14px)] before:content-[''] after:h-0.5 after:flex-1 after:bg-[image:repeating-linear-gradient(90deg,var(--line-strong)_0_8px,transparent_8px_14px)] after:content-['']",
);

/** `.csp-stitch-label`. */
export const stitchLabelClasses = tw('font-display text-[14px] font-bold tracking-[.16em] text-accent-ink uppercase');

/** `.csp-cut`, with the `@media (min-width: 1024px)` padding as `lg:`. */
export const sectionCutClasses = tw(
  'relative px-4 py-[calc(var(--space-16)+var(--cut-angle))] lg:px-6 lg:py-[calc(var(--space-24)+var(--cut-angle))]',
);

/** `.csp-cut-top.csp-cut-bottom`, `.csp-cut-top:not(.csp-cut-bottom)`, `.csp-cut-bottom:not(.csp-cut-top)`. */
export const sectionCutClipClasses = {
  both: tw('[clip-path:polygon(0_var(--cut-angle),100%_0,100%_calc(100%_-_var(--cut-angle)),0_100%)]'),
  top: tw('[clip-path:polygon(0_var(--cut-angle),100%_0,100%_100%,0_100%)]'),
  bottom: tw('[clip-path:polygon(0_0,100%_0,100%_calc(100%_-_var(--cut-angle)),0_100%)]'),
} as const;

/** `.csp-cut-surface` / `.csp-cut-accent`. */
export const sectionCutToneClasses = {
  surface: tw('bg-surface'),
  accent: tw('bg-accent text-on-accent'),
} as const satisfies Record<SectionCutTone, string>;

/** `.csp-cut-inner`. */
export const sectionCutInnerClasses = tw('mx-auto max-w-(--container-max)');

/** `.csp-media-ph`, an inline-size container for its number. MediaPlaceholder sets the ratio next to its style. */
export const mediaPlaceholderClasses = tw(
  '@container relative flex w-full items-end overflow-hidden bg-surface-2 text-ink-muted',
);

/** `.csp-media-ph-num`: the huge outlined italic number, and its App. B `transition: transform .4s ease`. */
export const mediaNumberClasses = tw(
  'absolute top-[50%] right-[6%] [transform:translateY(-55%)] font-display text-[length:clamp(36px,46cqi,240px)] leading-[.8] font-heavy tracking-[-.02em] text-transparent italic transition-[transform] duration-[.4s] ease-[ease] [-webkit-text-stroke:2px_var(--line-strong)]',
);

/** `.csp-media-ph-label`: the chip. */
export const mediaLabelClasses = tw(
  'relative m-3 inline-flex items-center gap-1.5 rounded-xs bg-surface-3 px-2 py-1 text-[12px] leading-4 font-semibold',
);
