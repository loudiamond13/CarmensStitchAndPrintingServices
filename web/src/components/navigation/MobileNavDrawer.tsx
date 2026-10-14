// SPEC-GAP: mobile nav drawer
// The phone navigation drawer (CSPS-UI-SPEC.md §2.10 #6, UI-SPEC "SPEC-GAP Primitive Specs" → MobileNavDrawer; plan
// 02-32; WEB-05, A11Y-02). App. D.3 draws no drawer for the admin: on phones the Topbar's "Open navigation" button opens
// this one, holding the full Sidebar (the caller passes it as children) as a 248px left panel over the scrim. It is
// composed from existing looks and tokens only (navigation.recipe.ts) and renders where it is placed, inside the page
// root, never in a portal.
//   - The panel is a modal dialog named "Navigation" (role dialog, modal) with the `id` the menu
//     button's `aria-controls` names.
//   - Focus moves into it on open and Tab / Shift+Tab stay inside (useFocusTrap on the panel's own ref). When it
//     closes, focus returns to the button that controls it (the element whose `aria-controls` names the panel), else
//     (no controller) to whatever had focus on open, as the trap does. The controller is looked up, not
//     remembered: Safari does not focus a button on a click, so a drawer opened by a tap would otherwise hand focus
//     back to the body.
//   - It closes on Esc, on a click on the scrim (a click, not a mousedown, so the release never lands on what the scrim
//     covered) and when a link inside is followed (a navigation); other controls (the collapse toggle, Logout) keep it
//     open. The link click is read on the document, after React's root listener has let the router handle it: closing
//     earlier would unmount the link before React dispatches its click, and the browser would then load the page
//     anew. Listeners go through refs and an effect (Pitfall 7: no JSX handlers on static elements).
//   - Body scroll is locked with the class while it is open (useBodyScrollLock).
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { isTopFocusTrap, useBodyScrollLock, useFocusTrap } from '@/components/overlays';
import { drawerClasses, drawerPanelClasses } from './navigation.recipe';

export interface MobileNavDrawerProps {
  /** The drawer is shown while true. */
  open: boolean;
  /** Called on Esc, a scrim click or a followed link; the caller sets `open` to false. */
  onClose: () => void;
  /** The panel's id: the menu button's `aria-controls`. */
  id: string;
  /** The Sidebar. */
  children?: ReactNode;
}

/** The element whose `aria-controls` names `id` (the menu button), if it is still in the document. */
function controllerOf(id: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[aria-controls]')].find((element) =>
    (element.getAttribute('aria-controls') ?? '').split(/\s+/).includes(id),
  );
}

/**
 * On close, focuses the drawer's controller. Its cleanup runs after the focus trap's (effects clean up in the order they
 * were declared), which has already returned focus to the element that had it on open; React removes the drawer and
 * the frame's `inert` in the same commit, before any cleanup, so the button can take focus.
 */
function useFocusControllerOnClose(id: string): void {
  useEffect(
    () => () => {
      controllerOf(id)?.focus();
    },
    [id],
  );
}

export function MobileNavDrawer({ open, ...props }: MobileNavDrawerProps) {
  return open ? <OpenDrawer {...props} /> : null;
}

function OpenDrawer({ onClose, id, children }: Omit<MobileNavDrawerProps, 'open'>) {
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef);
  useFocusControllerOnClose(id);
  useBodyScrollLock();

  const requestClose = useEffectEvent(onClose);

  useEffect(() => {
    const layer = layerRef.current;
    const panel = panelRef.current;
    if (layer === null || panel === null) {
      return undefined;
    }
    const onLayerClick = (event: MouseEvent) => {
      if (event.target === layer) {
        requestClose();
      }
    };
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target !== null && panel.contains(target) && target.closest('a[href]') !== null) {
        requestClose();
      }
    };
    // UI-WR-01: Esc closes the drawer only while it is the overlay on top (a dialog opened over it closes first), and
    // marks the key as handled.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && isTopFocusTrap(panel)) {
        event.preventDefault();
        requestClose();
      }
    };
    layer.addEventListener('click', onLayerClick);
    document.addEventListener('click', onDocumentClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      layer.removeEventListener('click', onLayerClick);
      document.removeEventListener('click', onDocumentClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={layerRef} className={drawerClasses}>
      <div
        ref={panelRef}
        id={id}
        className={drawerPanelClasses}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {children}
      </div>
    </div>
  );
}
