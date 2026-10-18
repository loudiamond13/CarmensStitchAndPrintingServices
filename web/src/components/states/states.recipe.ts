// SPEC-GAP: state looks (UI-SPEC "SPEC-GAP Primitive Specs": ErrorState, Skeleton family + LoadingRegion, LazyImage).
// Composed only from App. B/C looks and tokens (D-33): the `.s-banner.is-danger` banner and App. E.8's inline layout.
// Every string in this file is a class list (the class gate compiles them all).
import { tw } from '@/ui/tw';

/**
 * App. C `.s-banner` + `.s-banner.is-danger` with App. E.8's inline `align-items: center`: flex, gap 12px, padding
 * 12px 16px, radius 8, 14px/20px, the `--danger-soft` fill, `--danger` text (the icon) and a 1px border of `--danger`
 * mixed 40% into transparent, in srgb as written. Its descendant rules come along as written: `strong` is a block in
 * `--ink`, and every `span` is `--ink-muted` (this reaches the Try Again label span too, as it does in App. E.8).
 */
export const bannerClasses = tw(
  'flex items-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-danger-soft px-4 py-3 text-[14px] leading-5 text-danger [&_span]:text-ink-muted [&_strong]:block [&_strong]:text-ink',
);

/**
 * App. E.8's `<div style="flex: 1">` around the bold and muted lines, plus `min-width: 0` and `overflow-wrap:
 * anywhere`: a long traceId reference (one 32-character run) must wrap inside the banner at 320px instead of pushing
 * Try Again out past its edge (no horizontal scroll, PERF-03; App. E.8 never shows a reference, so it has no rule).
 */
export const bannerTextClasses = tw('min-w-0 flex-1 wrap-anywhere');

/** SkeletonText: its three lines in a grid, 8px apart. */
export const skeletonTextClasses = tw('grid gap-2');

/** App. E.8's skeleton order card: the `.csp-card` look (cardClasses) clipped by `overflow: hidden`. */
export const skeletonCardClasses = tw('overflow-hidden');

/** App. E.8's `<div style="padding: 16px; display: grid; gap: 10px">` under the media block. */
export const skeletonCardBodyClasses = tw('grid gap-2.5 p-4');

/** LazyImage's box: relative and clipped; its height comes from the aspect ratio set next to its `--ratio`. */
export const lazyBoxClasses = tw('relative overflow-hidden');

/** The image fills the box and is cropped to it. */
export const lazyImageClasses = tw('block size-full object-cover');

/** The loading Skeleton covers the whole box. */
export const lazySkeletonClasses = tw('absolute inset-0');

/** The error MediaPlaceholder fills the box's height. */
export const lazyFallbackClasses = tw('h-full');

/**
 * `.s-banner.is-danger` with App. C's own `align-items: flex-start` (App. E.5's sign-in banner): the same look as
 * bannerClasses, with the icon and the text at the top. App. E.8's centred banner is the default.
 */
export const bannerStartClasses = tw(
  'flex items-start gap-3 rounded-sm border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-danger-soft px-4 py-3 text-[14px] leading-5 text-danger [&_span]:text-ink-muted [&_strong]:block [&_strong]:text-ink',
);

/** The note's text: a long email or name in it wraps anywhere inside the note (no sideways scroll at 320px). */
export const noteTextClasses = tw('wrap-anywhere');

/** App. C `.s-note`: flex, gap 8px, padding 12px, radius 8, `--surface-2`, 13px/18px in `--ink-muted`. */
export const noteClasses = tw(
  'flex items-start gap-2 rounded-sm bg-surface-2 p-3 text-[13px] leading-[18px] text-ink-muted',
);
