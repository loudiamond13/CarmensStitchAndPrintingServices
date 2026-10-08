// The choice looks (App. B `.csp-seg*` and `.csp-tab*`, CSPS-UI-SPEC.md §6.3) as complete Tailwind tokens (D-33).
// Every string in this file is a class list (the class gate reads them all). The selected state comes from the
// attribute that states it (`aria-checked`, `aria-selected`), never from an `is-on` class.
import { tw } from '@/ui/tw';

/** `.csp-seg`: the 3px-padded track. */
export const segmentedClasses = tw('');

/** `.csp-seg-btn`, `:hover` and `.is-on` (here `aria-checked="true"`). */
export const segmentClasses = tw('');
