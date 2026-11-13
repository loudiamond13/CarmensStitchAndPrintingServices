// The Gallery lightbox looks (UI-SPEC G2, App. E.3; App. C `.s-lb-*`) as complete Tailwind tokens (D-33). The frame, the top bar,
// the counter and Close come from photoViewer.recipe.ts. The root carries data-theme="dark", so the brand-fixed chrome colors are
// the Espresso tokens. Every string is a class list that the class gate compiles.
import clsx from 'clsx';
import { tw } from '@/ui/tw';

/** `.s-lb-stage`: the 56 / 1fr / 56 grid; one column at 767px and below, where the 56px buttons are replaced by tap zones (C-35). */
export const lightboxStageClasses = tw(
  'grid w-full max-w-[1100px] grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-4 vp-lt-md:grid-cols-1',
);

/** `.s-lb-nav`: a 56px round button, a `--line-strong` border on `--surface`, orange on hover; gone at 767px and below (C-35). */
const navBase = tw(
  'row-start-1 grid size-14 cursor-pointer place-items-center rounded-pill border border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent hover:text-on-accent vp-lt-md:hidden',
);
export const lightboxPreviousClasses = clsx(navBase, 'col-start-1');
export const lightboxNextClasses = clsx(navBase, 'col-start-3');

/**
 * The image box's frame: 4 / 3, at most `min(680px, 100dvh - 320px)` tall, so its width follows from that height; centred in
 * its column and the whole column on phones. It is the positioning parent of the tap zones. `touch-pan-y` leaves the
 * vertical scroll to the browser and gives the horizontal swipe to the page.
 */
export const lightboxFrameClasses = tw(
  'relative col-start-2 row-start-1 w-[calc(min(680px,100dvh-320px)*4/3)] max-w-full min-w-0 touch-pan-y justify-self-center vp-lt-md:col-start-1 vp-lt-md:w-full',
);

/**
 * C-35 / 02 D-06: the phone tap zones. Two invisible buttons, each a third of the photo box wide and as tall as it, shown at
 * 767px and below where the 56px buttons are gone. The focus ring is the 2px chrome ink, drawn inside the zone.
 */
const zoneBase = tw(
  'absolute inset-y-0 z-10 hidden w-1/3 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid vp-lt-md:block',
);
export const lightboxZonePreviousClasses = clsx(zoneBase, 'left-0');
export const lightboxZoneNextClasses = clsx(zoneBase, 'right-0');

/** The jersey drawn when an item has no photo: the photo's 4 / 3 box on the placeholder ground with the dot grid. */
export const lightboxArtClasses = tw(
  'relative grid aspect-4/3 w-full place-items-center overflow-hidden rounded-lg bg-surface-2 bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);
export const lightboxArtJerseyClasses = tw('h-[78%] w-auto');

/** The thumbnail row of an item with several photos: centred, 8px apart, wrapping. */
export const lightboxThumbsClasses = tw('flex w-full max-w-[1100px] flex-wrap justify-center gap-2');

/** A thumbnail button: 56px square, 44px at 420px and below, with a 2px chrome-ink focus ring. */
const thumbBase = tw(
  'relative size-14 flex-none cursor-pointer overflow-hidden rounded-sm border-0 bg-surface-2 p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid vp-xs:size-11',
);
export const lightboxThumbClasses = thumbBase;
/** The thumbnail's photo fills its button. */
export const lightboxThumbImageClasses = tw('size-full');
/** The shown thumbnail: a 2px chrome-ink ring. */
export const lightboxThumbOnClasses = clsx(thumbBase, 'ring-2 ring-ink');

/** `.s-lb-cap`: the team, the meta line and the quote button, centred under the photo. */
export const lightboxCaptionClasses = tw('flex w-full max-w-[1100px] flex-col items-center gap-2 text-center');

/** The team: display 30, upper case; a long name wraps. */
export const lightboxTeamClasses = tw('m-0 font-display text-[30px] leading-[1.05] font-heavy wrap-anywhere uppercase');

/** "{Basketball} · {17} pcs · {note}": Small, in the chrome meta color. */
export const lightboxMetaClasses = tw('m-0 text-[14px] leading-5 wrap-anywhere text-ink-muted');

/** The skeleton shown while the lightbox chunk loads: the same 4 / 3 box, centred in the frame. */
export const lightboxLoadingClasses = tw(
  'aspect-4/3 w-[calc(min(680px,100dvh-320px)*4/3)] max-w-full min-w-0 overflow-hidden rounded-lg',
);

/** `.s-lb-img`: the photo's own box (LazyImage), radius 18; the photo is never cropped. */
export const lightboxImageClasses = tw('w-full rounded-lg bg-surface-2');
