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
