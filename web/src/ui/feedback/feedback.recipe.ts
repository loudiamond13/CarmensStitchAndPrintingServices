// The feedback looks (App. B `/* ── Feedback ── */`, CSPS-UI-SPEC.md §6.5) as complete Tailwind tokens (D-33). Every
// string in this file is a class list (the class gate reads them all).
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
