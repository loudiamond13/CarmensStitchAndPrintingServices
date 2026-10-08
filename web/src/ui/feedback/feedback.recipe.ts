// The feedback looks (App. B `/* ── Feedback ── */`, CSPS-UI-SPEC.md §6.5) as complete Tailwind tokens (D-33). Every
// string in this file is a class list (the class gate reads them all).
import type { ToastTone } from './Toast';
import { tw } from '@/ui/tw';

/** `.csp-empty`: a centred column inside a 2px dashed `--line` box, radius 12, 48px by 24px padding. */
export const emptyClasses = tw(
  'flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-line px-6 py-12 text-center',
);

/** `.csp-empty-icon`: the 64px `--accent-soft` tile, radius 12, turned -6deg (one exact transform, Pitfall 25). */
export const emptyIconClasses = tw(
  'mb-2 grid size-16 [transform:rotate(-6deg)] place-items-center rounded-md bg-accent-soft text-accent-ink',
);

/** `.csp-empty-icon .csp-icon`: the icon turned back upright inside the tile. */
export const emptyIconGlyphClasses = tw('[transform:rotate(6deg)]');

/** `.csp-empty-title`: the display face, 700, 26px with a 1.1 line height, no margin. */
export const emptyTitleClasses = tw('m-0 font-display text-[26px] leading-[1.1] font-bold');

/**
 * `.csp-empty-msg`: 14px/20px `--ink-muted`, at most 380px wide. Its own `margin: 0 0 12px` never applies in the
 * approved design: App. C `.s-page p { margin: 0 }` is more specific and comes later, and every EmptyState sits inside
 * the page root, so the computed margin is 0 and the gap above the action is the column's 8px.
 */
export const emptyMessageClasses = tw('m-0 max-w-[380px] text-[14px] leading-5 text-ink-muted');

/**
 * `.csp-skel`: a block shimmering from `--surface-2` through `--line` (background 200% wide, 1.4s). Its size and radius
 * are per instance, so Skeleton sets `--sk-w`, `--sk-h` and `--sk-r` and these utilities read them (UI-SPEC "Inline
 * style rule"). Reduced motion stops the shimmer (D-31 O-6).
 */
export const skeletonClasses = tw(
  'block h-(--sk-h) w-(--sk-w) animate-csp-shimmer rounded-(--sk-r) bg-[image:linear-gradient(90deg,var(--surface-2)_0%,var(--line)_50%,var(--surface-2)_100%)] bg-size-[200%_100%] motion-reduce:animate-none',
);

/**
 * `.csp-toast`: the `--surface-3` card (max 400px, radius 12, `--shadow-3`) with the stitched 3px left edge drawn by
 * `::before` in the tone's colour, rising in over 0.2s; reduced motion stops the entry (D-31 O-6).
 */
export const toastClasses = tw(
  "relative flex w-full max-w-[400px] animate-csp-rise items-start gap-3 overflow-hidden rounded-md border border-line bg-surface-3 py-3 pr-3 pl-4 [box-shadow:var(--shadow-3)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[image:repeating-linear-gradient(180deg,currentColor_0_6px,transparent_6px_10px)] before:content-[''] motion-reduce:animate-none",
);

/** `.csp-toast-<tone>::before`: the stitched edge's colour, one complete literal per tone. */
export const toastEdgeToneClasses = {
  success: tw('before:text-success'),
  danger: tw('before:text-danger'),
  info: tw('before:text-info'),
  warning: tw('before:text-warning'),
} as const satisfies Record<ToastTone, string>;

/** `.csp-toast-icon`: 6px down, so the 20px icon sits on the title's line. */
export const toastIconClasses = tw('pt-1.5');

/** `.csp-toast-<tone> .csp-toast-icon`: the icon's colour, one complete literal per tone. */
export const toastIconToneClasses = {
  success: tw('text-success'),
  danger: tw('text-danger'),
  info: tw('text-info'),
  warning: tw('text-warning'),
} as const satisfies Record<ToastTone, string>;

/** `.csp-toast-text`: the bold title over the message, 14px/20px, taking the free width. */
export const toastTextClasses = tw('flex flex-1 flex-col pt-1.5 text-[14px] leading-5');

/** `.csp-toast-text span`: the message in `--ink-muted`. */
export const toastMessageClasses = tw('text-ink-muted');

/**
 * `.csp-iconbtn`: the 36px borderless icon button (`--ink-muted`, `--surface-2` and `--ink` on hover) that closes a
 * toast. 36px is the owner's recorded target-size exception (D-31 O-8).
 */
export const iconButtonClasses = tw(
  'inline-grid size-9 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
);
