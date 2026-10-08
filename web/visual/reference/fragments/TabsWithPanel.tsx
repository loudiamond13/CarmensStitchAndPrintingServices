// Reference side of the dev-only tabs-with-panel wrapper (plan 02-19; test only, never shipped): the frozen App. D.3
// Tabs followed by a plain panel block, the same elements as web/src/dev/previews/TabsWithPanel.tsx. App. D.3's Tabs
// have no ids to point at, so this panel carries no tab-panel attributes; attributes are not compared. No look of its own.
import type { ReactNode } from 'react';

export interface TabsWithPanelProps {
  children?: ReactNode;
  panel: string;
}

export function TabsWithPanel({ children, panel }: TabsWithPanelProps) {
  return (
    <>
      {children}
      <div>{panel}</div>
    </>
  );
}
