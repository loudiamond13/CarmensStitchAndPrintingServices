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

/** The skeleton shown while the lightbox chunk loads: the same 4 / 3 box, centred in the frame. */
export const lightboxLoadingClasses = tw(
  'aspect-4/3 w-[calc(min(680px,100dvh-320px)*4/3)] max-w-full min-w-0 overflow-hidden rounded-lg',
);

/** `.s-lb-img`: the photo's own box (LazyImage), radius 18; the photo is never cropped. */
export const lightboxImageClasses = tw('w-full rounded-lg bg-surface-2');
