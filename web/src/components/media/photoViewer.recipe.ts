// SPEC-GAP: photo viewer looks (UI-SPEC P4 "Photo viewer", Spacing "Viewer stage", Color "Viewer chrome"). The App. C
// `.s-lightbox`, `.s-lb-top`, `.s-lb-stage`, `.s-lb-img`, `.s-lb-nav`, `.s-lb-cap` and `.s-lb-close` rules as complete
// Tailwind tokens (D-33). Every string in this file is a class list (the class gate compiles them all).
//
// The viewer root carries `data-theme="dark"`, so the brand-fixed lightbox chrome is the Espresso tokens in both themes:
// `--bg` #1a100f (scrim), `--ink` #f6dfd1 (text), `--line-strong` #8f6c62 (borders) and `--surface` #241614 (button
// ground) are exactly the four App. C literals. No colour literal appears in a class.
//
// SPEC-DEVIATION: D-16 App. C hides Previous and Next on phones. Here they stay: at 639px and below the stage is one
// column, the image first, then Previous and Next (44 x 44) on the left and "Open Full Size" on the right of one row,
// then the description. The caption row turns into `display: contents` so its two children join the stage grid.
import clsx from 'clsx';
import { tw } from '@/ui/tw';

/**
 * `.s-lightbox`: fixed at `--z-overlay` (80), the `--bg` scrim at 94%, a centred column with 16px between rows and 24px
 * padding (16px and vertically centred on phones). The fade is off under reduced motion; it scrolls on a short window.
 */
export const viewerRootClasses = tw(
  'fixed inset-0 z-(--z-overlay) flex animate-csp-fade flex-col items-center gap-4 overflow-y-auto bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] p-6 text-ink motion-reduce:animate-none vp-lt-sm:justify-center vp-lt-sm:p-4',
);

/** `.s-lb-top`: the counter on the left and Close on the right, up to 1100px wide. */
export const viewerTopClasses = tw('flex w-full max-w-[1100px] items-center justify-between');

/** The counter: Small, tabular. */
export const viewerCounterClasses = tw('text-[14px] leading-5 tabular-nums');

/** `.s-lb-close` (44 x 44, radius 8, a `--line-strong` border, transparent ground) and the shape "Open Full Size" shares. */
export const viewerCloseClasses = tw(
  'grid size-11 cursor-pointer place-items-center rounded-sm border border-line-strong bg-transparent text-ink',
);

/**
 * `.s-lb-stage`: a 56 / 1fr / 56 grid, 16px apart. At 639px and below it is the auto / auto / 1fr grid of the phone
 * layout, 16px between rows and 8px between Previous and Next.
 */
export const viewerStageClasses = tw(
  'grid w-full max-w-[1100px] grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-4 vp-lt-sm:grid-cols-[auto_auto_minmax(0,1fr)] vp-lt-sm:gap-x-2',
);

/**
 * `.s-lb-img`: the image box (LazyImage's box, with its own ratio). Radius 18 on `--surface-2`, at most
 * `min(680px, 100dvh - 200px)` tall; the photo is fitted inside it, never cropped. Full width on phones.
 */
export const viewerImageClasses = tw(
  'col-start-2 row-start-1 max-h-[min(680px,calc(100dvh-200px))] min-w-0 rounded-lg bg-surface-2 vp-lt-sm:col-span-full',
);

/**
 * `.s-lb-nav`: a 56px round button, a `--line-strong` border on `--surface`, orange on hover. 44px on phones, in the
 * row under the photo.
 */
const navBase = tw(
  'grid size-14 cursor-pointer place-items-center rounded-pill border border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent hover:text-on-accent vp-lt-sm:row-start-2 vp-lt-sm:size-11',
);

export const viewerPreviousClasses = clsx(navBase, 'col-start-1 row-start-1');
export const viewerNextClasses = clsx(navBase, 'col-start-3 row-start-1 vp-lt-sm:col-start-2');

/**
 * `.s-lb-cap`: the description and "Open Full Size" in a wrapping row, 12px apart, spread across the stage. On phones it
 * is `display: contents`, so the description and the link become cells of the stage grid.
 */
export const viewerCaptionClasses = tw(
  'col-span-full row-start-2 flex flex-wrap items-center justify-between gap-3 vp-lt-sm:contents',
);

/** The description in Body: it wraps anywhere, so a long one never widens the stage. Phones: its own row under the buttons. */
export const viewerDescriptionClasses = tw(
  'm-0 min-w-0 flex-1 text-[16px] leading-6 wrap-anywhere vp-lt-sm:col-span-full vp-lt-sm:row-start-3',
);

/** "Open Full Size": the `.s-lb-close` look, 44px tall with 16px side padding. Phones: right of Previous and Next. */
export const viewerFullSizeClasses = tw(
  'relative inline-flex min-h-11 max-w-full items-center gap-2 rounded-sm border border-line-strong px-4 py-2 font-button text-ink no-underline vp-lt-sm:col-start-3 vp-lt-sm:row-start-2 vp-lt-sm:justify-self-end',
);
