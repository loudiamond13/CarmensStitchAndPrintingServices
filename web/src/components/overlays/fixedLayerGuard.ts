// Fixed-layer guard (code review WR-05, 02-REVIEW-d41.md). The ResponsiveTable frame keeps the paint containment the
// owner ruled in D-41 R2-02 (`contain-paint` on `tableWrapClasses`). Paint containment, like a transform, makes the
// frame the containing block of `position: fixed` descendants and clips them to it, so a Modal or ConfirmDialog
// rendered in a table cell would get a scrim that covers only the table and a panel that scrolls with the rows, while
// its focus trap holds focus in a dialog the user may not see. The frame therefore provides PaintContainmentContext,
// and an open Modal (so ConfirmDialog and an Overlay's inline Modal too) calls useFixedLayerGuard first and refuses to
// render there with a plain-English error. A row action keeps the dialog's open state on the page and renders the
// dialog outside the table.
//
// Why a runtime invariant and not a portal (the review's first option):
//   - CSPS-UI-SPEC.md §2.7 (frozen) requires anything in a portal to sit inside `[data-theme]` and `.s-page`: the
//     Espresso theme comes from `.s-page[data-theme]`, and the Overlay region's phone sheet uses the `pg` container
//     (`pg-phone:` variants in overlayRegionClasses). 02-RESEARCH.md lists the body portal as an anti-pattern,
//     02-UI-SPEC.md says "never a portal to <body>", and plan 02-22 pinned zero portals in Modal.tsx.
//   - A portal to `document.body` would render admin dark-mode dialogs in Blush and drop the phone sheet, breaking the
//     D-08 approved look.
//   - `position: relative` on the frame instead of paint containment needs an owner ruling (deferred-items.md).
// It is a runtime invariant with tests, not a static scan, so a future in-cell dialog fails its first component test.
// It is internal to lists and overlays and deliberately not exported from the `@/components/overlays` or `@/components` barrels.
import { createContext, use } from 'react';

/** True inside a paint-contained frame (the ResponsiveTable frame), where `position: fixed` content is trapped. */
export const PaintContainmentContext = createContext<boolean>(false);

/** Throws the WR-05 error when the component renders inside a paint-contained frame. */
export function useFixedLayerGuard(component: string): void {
  if (use(PaintContainmentContext)) {
    throw new Error(
      `${component} cannot render inside a ResponsiveTable frame: the frame's paint containment (D-41 R2-02) traps ` +
        'position: fixed, so the scrim would cover only the table and the dialog would scroll with the rows. Keep ' +
        "the dialog's open state on the page and render the dialog outside the table (code review WR-05).",
    );
  }
}
