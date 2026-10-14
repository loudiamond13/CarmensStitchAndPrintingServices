// Dev-only scenario wrapper (plan 02-23; never shipped, D-20): one plain block around an OrderTotals panel. The
// converted OrderTotals gives its internal-only note role="definition" by itself (A11Y-01: a <dl> may not hold a bare
// paragraph), so this side does nothing. The reference side gives the frozen App. D.3 note the same attribute after
// mount, so axe passes on both pages (web/visual/reference/fragments/DefinedTotalsNote.tsx); attributes are not
// compared. It adds no look of its own.
import type { ReactNode } from 'react';

export interface DefinedTotalsNoteProps {
  /** The OrderTotals node. */
  children?: ReactNode;
}

export function DefinedTotalsNote({ children }: DefinedTotalsNoteProps) {
  return <div>{children}</div>;
}
