// The choice looks (App. B `.csp-seg*` and `.csp-tab*`, CSPS-UI-SPEC.md §6.3) as complete Tailwind tokens (D-33).
// Every string in this file is a class list (the class gate reads them all). The selected state comes from the
// attribute that states it (`aria-checked`, `aria-selected`), never from an `is-on` class.
import { tw } from '@/ui/tw';

/** `.csp-seg`: the 3px-padded track on `--surface-2` with a 1px `--line` border. */
export const segmentedClasses = tw('inline-flex gap-0.5 rounded-sm border border-line bg-surface-2 p-[3px]');

/**
 * `.csp-seg-btn` (32px tall, kept by D-31 O-8), its `:hover` ink, and `.is-on` as `aria-checked="true"`: the raised
 * `--surface-3` segment with `--shadow-1` plus a 1px inset `--line` ring (one exact multi-layer shadow).
 */
export const segmentClasses = tw(
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent px-2.5 text-[14px] font-semibold text-ink-muted hover:text-ink aria-checked:bg-surface-3 aria-checked:text-ink aria-checked:[box-shadow:var(--shadow-1),inset_0_0_0_1px_var(--line)]',
);

/**
 * `.csp-tabs`: one row on a 1px `--line` rule. It scrolls sideways inside itself when the tabs do not fit (a phone),
 * with the scrollbar hidden as App. B hides it; arrow keys still reach every tab, and the page never scrolls sideways.
 */
export const tabListClasses = tw('flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-line');

/**
 * `.csp-tab`, `:hover`, and `.is-on` as `aria-selected="true"`: the selected tab is ink and bold (D-03: 700 against its
 * neighbours' 600, so orange is never the only cue) with the 3px `--accent-line` underline drawn by `::after`. The
 * `group/tab` marker lets the count chip follow the selection.
 */
export const tabClasses = tw(
  "group/tab relative inline-flex h-11 cursor-pointer items-center gap-2 border-0 bg-transparent px-4 text-[14px] font-semibold whitespace-nowrap text-ink-muted hover:text-ink aria-selected:font-bold aria-selected:text-ink aria-selected:after:absolute aria-selected:after:right-3 aria-selected:after:-bottom-px aria-selected:after:left-3 aria-selected:after:h-[3px] aria-selected:after:rounded-[3px_3px_0_0] aria-selected:after:bg-accent-line aria-selected:after:content-['']",
);

/** `.csp-tab-count`, and `.csp-tab.is-on .csp-tab-count` through the tab's `group/tab` selection. */
export const tabCountClasses = tw(
  'h-5 min-w-[22px] rounded-xs bg-neutral-soft px-1.5 text-center text-[12px] leading-5 text-ink-muted tabular-nums group-aria-selected/tab:bg-accent-soft group-aria-selected/tab:text-accent-ink',
);
