// Reference side of the Overlay region (plan 02-22; test only, never shipped): the App. C `.s-overlay` block the
// mockups render a dialog in (`<div className="s-overlay"><Modal inline … /></div>`, spec §2.8 and App. E.7/E.10), the
// same element as the converted Overlay (web/src/ui/overlays/Overlay.tsx). App. D.3 has no component for it.
import type { ReactNode } from 'react';

export interface OverlayProps {
  children?: ReactNode;
}

export function Overlay({ children }: OverlayProps) {
  return <div className="s-overlay">{children}</div>;
}
