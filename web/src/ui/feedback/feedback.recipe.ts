// The feedback looks (App. B `/* ── Feedback ── */`, CSPS-UI-SPEC.md §6.5) as complete Tailwind tokens (D-33). Every
// string in this file is a class list (the class gate reads them all).
import { tw } from '@/ui/tw';

/** `.csp-empty`: a centred column inside a 2px dashed `--line` box, radius 12, 48px by 24px padding. */
export const emptyClasses = tw(
  'flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-line px-6 py-12 text-center',
);

/** `.csp-empty-icon`: the 64px `--accent-soft` tile, radius 12, turned -6deg (one exact transform, Pitfall 25). */
export const emptyIconClasses = tw(
  'mb-2 grid size-16 place-items-center rounded-md bg-accent-soft text-accent-ink [transform:rotate(-6deg)]',
);

/** `.csp-empty-icon .csp-icon`: the icon turned back upright inside the tile. */
export const emptyIconGlyphClasses = tw('[transform:rotate(6deg)]');

/** `.csp-empty-title`: the display face, 700, 26px with a 1.1 line height, no margin. */
export const emptyTitleClasses = tw('m-0 font-display text-[26px] leading-[1.1] font-bold');

/** `.csp-empty-msg`: 14px/20px `--ink-muted`, at most 380px wide, 12px above the action. */
export const emptyMessageClasses = tw('mx-0 mt-0 mb-3 max-w-[380px] text-[14px] leading-5 text-ink-muted');
