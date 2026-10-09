// Overlay: the App. C `.s-overlay` region the mockups render dialogs in (spec §2.8 "Modals", §2.10 #3, App. E.7/E.10):
// `<Overlay><Modal inline … /></Overlay>` puts the dialog on a fixed scrim, top-aligned 140px down on desktop and 96px
// down as a full-width sheet on phone pages. App. D.3 has no component for it (screens wrote the class), so under D-33
// it is this region with the `data-ui="s-overlay"` marker, which the dialog's region looks key off. It renders inside
// the page root like every overlay (never a portal), and a mousedown on it closes an inline Modal (see Modal).
import type { ReactNode } from 'react';
import { overlayRegionClasses } from './overlays.recipe';

export interface OverlayProps {
  /** One inline Modal or ConfirmDialog. */
  children?: ReactNode;
}

export function Overlay({ children }: OverlayProps) {
  return (
    <div data-ui="s-overlay" className={overlayRegionClasses}>
      {children}
    </div>
  );
}
