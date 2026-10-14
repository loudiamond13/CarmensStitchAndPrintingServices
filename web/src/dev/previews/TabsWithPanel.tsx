// Dev-only scenario wrapper (plan 02-19; never shipped, D-20): a tab list followed by the selected tab's panel, so the
// selected tab's `aria-controls` points at a real `role="tabpanel"` (axe checks it on every parity page). The panel
// takes its ids and role from getTabPanelProps, as every screen with tabs does. It adds no look of its own; the reference
// side renders the same elements around the frozen App. D.3 Tabs (web/visual/reference/fragments/TabsWithPanel.tsx).
import type { ReactNode } from 'react';
import { getTabPanelProps } from '@/ui/choice';

export interface TabsWithPanelProps {
  /** The Tabs node (its `idBase` must equal this one). */
  children?: ReactNode;
  idBase: string;
  /** The id of the selected tab. */
  selected: string;
  /** The panel's text. */
  panel: string;
}

export function TabsWithPanel({ children, idBase, selected, panel }: TabsWithPanelProps) {
  return (
    <>
      {children}
      <div {...getTabPanelProps(idBase, selected)}>{panel}</div>
    </>
  );
}
