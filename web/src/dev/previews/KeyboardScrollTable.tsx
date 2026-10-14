// Dev-only scenario wrapper (plan 02-24; never shipped, D-20): one plain block around a DataTable. The converted
// DataTable makes its sideways-scrolling frame a named, focusable region by itself (A11Y-01, axe
// scrollable-region-focusable, WCAG 2.1.1), so this side does nothing. The reference side gives the frozen App. D.3
// frame the same attributes after mount, so axe passes on both pages
// (web/visual/reference/fragments/KeyboardScrollTable.tsx); attributes are not compared. It adds no look of its own.
import type { ReactNode } from 'react';

export interface KeyboardScrollTableProps {
  /** The DataTable node. */
  children?: ReactNode;
}

export function KeyboardScrollTable({ children }: KeyboardScrollTableProps) {
  return <div>{children}</div>;
}
