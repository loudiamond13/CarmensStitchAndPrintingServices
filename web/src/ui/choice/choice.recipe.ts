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
