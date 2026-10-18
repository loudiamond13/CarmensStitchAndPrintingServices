// The overlay looks (App. B `/* ── Overlays ── */`, App. C `.s-overlay` rules, CSPS-UI-SPEC.md §6.5) as complete
// Tailwind tokens (D-33). Modal, ConfirmDialog and the Overlay region share them. Every string in this file is a class
// list (the class gate reads them all).
//
// - `vp-lt-sm:` is App. B's `@media (max-width: 639px)`: the centred modal becomes a bottom sheet and the slide-over
//   fills the width.
// - The region looks (`.s-overlay .csp-…`) come from the `data-ui="s-overlay"` marker through `in-data-[ui=s-overlay]:`
//   (any depth, like the spec's descendant selector); `.s-overlay > .csp-modal` keeps its child combinator.
// - App. C `.s-page h2, .s-page p { margin: 0 }` beats the App. B paragraph margins (`.csp-modal-desc`,
//   `.csp-cascade-lead`, `.csp-cascade-foot`), and every overlay renders inside the page root, so their computed margin
//   is 0 (`m-0`), as plan 02-21 found for `.csp-empty-msg`.
// - D-31 O-6: reduced motion stops the overlay fade and the modal entry (`motion-reduce:animate-none`).
// - D-39: a closing dialog (`data-state="closed"`) plays the `-out` animation and takes no clicks; reduced motion stops
//   that too, so it leaves the DOM at once (usePresence).
import clsx from 'clsx';
import { tw } from '@/ui/tw';

/** App. D.3 Modal variants: the centred dialog and the right-hand slide-over panel. */
export type ModalVariant = 'center' | 'slideover';

interface LayerOptions {
  readonly variant: ModalVariant;
  readonly inline: boolean;
}

/**
 * App. C `.s-overlay`: the fixed scrim region the mockups render dialogs in. It carries `data-ui="s-overlay"`.
 *
 * SPEC-DEVIATION: D-42 (owner, 2026-10-13, UAT G-2-199). App. C pinned the dialog 140px down (96px on phone pages)
 * with nothing to scroll, so on a short window the bottom of a tall dialog, buttons included, was off screen. Now the
 * region is a column: its `::before` is a spacer of 124px (96px on phone pages) above the dialog, so the 16px padding
 * plus the spacer is the approved 140px (96px plus 0 on phones) whenever the dialog fits. When it does not fit, only
 * the spacer shrinks, down to 0, so the dialog moves up to the 16px edge gap (0 on phones). `*:shrink-0` stops the
 * dialog itself from shrinking (App. C gives the inline overlay `min-height: 0`). `justify-start` keeps any overflow at
 * the bottom, where it can be scrolled to, and `overflow-y-auto` lets the backdrop scroll when the dialog is still
 * taller than the window (WCAG 1.4.10). `items-center` keeps the horizontal centring (the child is full width); the
 * phone `items-start` is dropped because in a column it would mean start-aligned sideways, and the rulings layer gives
 * the reference the same `center`. Pure CSS: no measuring and no inline style (strict CSP).
 */
export const overlayRegionClasses = tw(
  "fixed inset-0 z-(--z-overlay) flex flex-col items-center justify-start overflow-y-auto bg-scrim p-4 *:shrink-0 before:basis-[124px] before:content-[''] pg-phone:p-0 pg-phone:before:basis-[96px]",
);

/** `.csp-overlay` and `.csp-overlay.is-inline`: how the overlay is placed. */
const overlayPlacement = {
  fixed: tw(
    'fixed inset-0 animate-csp-fade data-[state=closed]:pointer-events-none data-[state=closed]:animate-csp-fade-out motion-reduce:animate-none motion-reduce:data-[state=closed]:animate-none',
  ),
  inline: tw(
    'relative inset-auto min-h-full animate-none in-data-[ui=s-overlay]:min-h-0 in-data-[ui=s-overlay]:w-full in-data-[ui=s-overlay]:bg-transparent in-data-[ui=s-overlay]:p-0',
  ),
} as const;

/**
 * `.csp-overlay` (scrim, centred, 16px padding), `.csp-overlay-slideover` (to the right edge, full height, no padding)
 * and, below 640px, `.csp-overlay:not(.csp-overlay-slideover)` (to the bottom, no padding).
 */
const overlayLayout = {
  center: tw('flex items-center justify-center bg-scrim p-4 vp-lt-sm:items-end vp-lt-sm:p-0'),
  slideover: tw('flex items-stretch justify-end bg-scrim p-0'),
} as const;

/** `.csp-overlay` z-index, which `.is-inline` keeps (a relative overlay still stacks at `--z-overlay`). */
const overlayStack = tw('z-(--z-overlay)');

/** The overlay root (the scrim). */
export function overlayClasses({ variant, inline }: LayerOptions): string {
  return clsx(overlayStack, overlayLayout[variant], inline ? overlayPlacement.inline : overlayPlacement.fixed);
}

/**
 * `.csp-modal`: the `--surface-3` panel (max 520px, radius 18, `--shadow-3`), rising in over 0.2s; App. C
 * `.s-overlay > .csp-modal` drops the entry, and on phone pages a modal in the region is a full-width sheet.
 */
const modalBase = tw(
  'flex w-full animate-csp-rise flex-col rounded-lg border border-line bg-surface-3 text-ink [box-shadow:var(--shadow-3)] motion-reduce:animate-none pg-phone:in-data-[ui=s-overlay]:max-w-none pg-phone:in-data-[ui=s-overlay]:rounded-t-lg pg-phone:in-data-[ui=s-overlay]:rounded-b-none [[data-ui=s-overlay]>&]:animate-none',
);

/**
 * `.csp-modal` size, `.csp-modal-slideover` (480px, full height, rounded on the left, sliding in) and, below 640px, the
 * bottom-sheet corners or the full-width slide-over.
 */
const modalShape = {
  center: tw('max-w-[520px] vp-lt-sm:rounded-t-lg vp-lt-sm:rounded-b-none'),
  slideover: tw(
    'h-full max-w-(--slideover-width) animate-csp-slide rounded-l-lg rounded-r-none vp-lt-sm:max-w-none vp-lt-sm:rounded-none',
  ),
} as const;

/** D-39: the exit motion of a closing dialog (the phone bottom sheet included), none for an inline one. */
const modalExit = {
  center: tw('data-[state=closed]:animate-csp-rise-out motion-reduce:data-[state=closed]:animate-none'),
  slideover: tw('data-[state=closed]:animate-csp-slide-out motion-reduce:data-[state=closed]:animate-none'),
} as const;

/** `.csp-modal` max height (100vh less 32px), removed for the slide-over and inside an inline overlay. */
const cappedHeight = tw('max-h-[calc(100vh-32px)]');
const noMaxHeight = tw('max-h-none');
const modalHeight = {
  center: { fixed: cappedHeight, inline: noMaxHeight },
  slideover: { fixed: noMaxHeight, inline: noMaxHeight },
} as const;

/** The dialog panel. */
export function modalClasses({ variant, inline }: LayerOptions): string {
  return clsx(
    modalBase,
    modalShape[variant],
    inline ? modalHeight[variant].inline : [modalHeight[variant].fixed, modalExit[variant]],
  );
}

/** `.csp-modal-head`: the title block and the Close button, 24px/24px/16px padding, a `--line` rule under it. */
export const modalHeadClasses = tw('flex items-start justify-between gap-4 border-b border-line px-6 pt-6 pb-4');

/** `.csp-modal-title`: the display face, 700, 24px with a 1.1 line height. */
export const modalTitleClasses = tw('m-0 font-display text-[24px] leading-[1.1] font-bold');

/** `.csp-modal-desc`: 14px/20px `--ink-muted` (its 4px top margin loses to App. C `.s-page p`). */
export const modalDescriptionClasses = tw('m-0 text-[14px] leading-5 text-ink-muted');

/** `.csp-modal-body`: the scrolling column, 20px/24px padding, 20px between blocks. */
export const modalBodyClasses = tw('flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5');

/**
 * `.csp-modal-foot`: the buttons on the right, 12px apart, a `--line` rule above; below 640px (App. B) and in the
 * region on phone pages (App. C) the buttons share the width.
 */
export const modalFootClasses = tw(
  'flex justify-end gap-3 border-t border-line px-6 py-4 pg-phone:in-data-[ui=s-overlay]:*:flex-1 vp-lt-sm:*:flex-1',
);

/** `.csp-confirm`: the danger icon tile beside the text column. */
export const confirmClasses = tw('flex items-start gap-4');

/** `.csp-confirm > div`: the text column (message, cascade box, type-to-confirm field), 16px apart. */
export const confirmColumnClasses = tw('flex min-w-0 flex-1 flex-col gap-4');

/** `.csp-confirm-icon`: the 44px round `--danger-soft` tile. */
export const confirmIconClasses = tw(
  'grid size-11 flex-none place-items-center rounded-pill bg-danger-soft text-danger',
);

/** `.csp-confirm-msg`: 15px/22px. */
export const confirmMessageClasses = tw('m-0 text-[15px] leading-[22px]');

/** `.csp-cascade`: the `--danger-soft` box with a dashed `--danger` border, radius 8, 16px padding. */
export const cascadeClasses = tw('rounded-sm border border-dashed border-danger bg-danger-soft p-4');

/** `.csp-cascade-lead`: the cascade sentence, 14px/20px, 650, `--ink` (its 12px bottom margin loses to `.s-page p`). */
export const cascadeLeadClasses = tw('m-0 text-[14px] leading-5 font-button text-ink');

/**
 * `.csp-cascade-list`: the five-tile tally, three columns on phone pages (App. C `repeat(3, minmax(0, 1fr))`). App. B's
 * own `@media (max-width: 420px) { repeat(3, 1fr) }` is not transcribed: inside the page root it never decides the
 * result, because the page root is then at most 420px wide too, and App. C's phone rule comes later in the cascade.
 */
export const cascadeListClasses = tw(
  'm-0 grid list-none grid-cols-[repeat(5,1fr)] gap-2 p-0 pg-phone:grid-cols-[repeat(3,minmax(0,1fr))]',
);

/** `.csp-cascade-list li`: one tile, 11px/14px 600 uppercase `--ink-muted` on `--surface-3`. */
export const cascadeItemClasses = tw(
  'flex flex-col items-center rounded-[6px] bg-surface-3 px-0.5 py-2 text-[11px] leading-[14px] font-semibold tracking-[.06em] text-ink-muted uppercase',
);

/** `.csp-cascade-list li span`: the count, display 700 26px, `--danger`, or `--ink-subtle` for a zero (`.is-zero`). */
const cascadeCountBase = tw('font-display text-[26px] leading-[1.1] font-bold tracking-[0] tabular-nums');

const cascadeCountTone = {
  some: tw('text-danger'),
  zero: tw('text-ink-subtle'),
} as const;

/** The count in one tile. */
export function cascadeCountClasses({ zero }: { readonly zero: boolean }): string {
  return clsx(cascadeCountBase, zero ? cascadeCountTone.zero : cascadeCountTone.some);
}

/** `.csp-cascade-foot`: "This can't be undone.", 12px/16px 600 `--danger` (its 12px top margin loses to `.s-page p`). */
export const cascadeFootClasses = tw('m-0 text-[12px] leading-4 font-semibold text-danger');

/** The class `useBodyScrollLock` toggles on `<body>` while an overlay is open (UI-SPEC: a class, never style.overflow). */
export const bodyScrollLockClass = tw('overflow-hidden');
