// The focus trap behind Modal (WEB-02 required fix, A11Y-02; research Pitfall 9: the App. D.3 Modal had no initial
// focus, no Tab trap and no focus return). It works on a ref to an element the component already renders, so it adds
// no wrapper element and the parity pairing of the dialog is unchanged. While active:
// - on activation, focus moves to `initialFocus`, else the first field (input, select, textarea), else the first
//   focusable element, else the container itself (given tabIndex -1 if it has no tabindex);
// - Tab on the last focusable element moves to the first, Shift+Tab on the first moves to the last, and focus that
//   lands outside the container (a click elsewhere, a script) comes back to the first focusable element;
// - when the trap ends, focus returns to the element that had it on activation (the trigger), if it is still there.
// UI-WR-02: traps stack. Overlays render in place, never in a portal, so a dialog opened from the phone drawer is the
// drawer's DOM sibling, and two traps that both pulled focus into their own root would fight over it. Only the newest
// active trap (the top of the stack) acts on Tab and on focus that leaves it; the ones below wait. A trap joins the
// stack before it moves focus. When the top trap ends, focus returns to its trigger and, if that leaves focus outside
// the trap now on top, moves into that trap; a trap that ends below another changes nothing about focus.
// UI-WR-03: the toast layer (`data-ui="s-toast-layer"`, outside every dialog) is the one region outside the trap that
// focus may visit, because danger and warning toasts stay until they are closed (D-04, D-31 O-7) and a failed save is
// reported there. Tab goes from the dialog's last element to the toasts' first and from their last back to the
// dialog's first (Shift+Tab the other way), and focus on a toast is never pulled back. An inert layer is skipped.
// Listeners are added with addEventListener in an effect (Pitfall 7: no JSX handlers on static elements).
import { useEffect, type RefObject } from 'react';

export interface FocusTrapOptions {
  /** The trap runs only while true (default true). */
  readonly active?: boolean;
  /** The element to focus on activation; its ref must be attached by then (render it inside the container). */
  readonly initialFocus?: RefObject<HTMLElement | null> | undefined;
  /** Return focus to the trigger when the trap ends (default true). */
  readonly returnFocus?: boolean;
}

/** Elements that take focus from the Tab key (disabled controls and tabindex -1 excluded below). */
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[tabindex]',
].join(',');

/** Fields a person types into or picks from: the first one gets the initial focus. */
const FIELD = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

function tabbable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.tabIndex >= 0 && element.closest('[hidden], [inert]') === null,
  );
}

/** The toast layer ToastProvider renders (UI-WR-03). */
const TOAST_LAYER = '[data-ui="s-toast-layer"]';

/** True when the node is inside a toast layer outside `root`. */
function inToastLayer(root: HTMLElement, node: Node | null): boolean {
  const element = node instanceof Element ? node : null;
  const layer = element?.closest(TOAST_LAYER);
  return layer != null && !root.contains(layer);
}

/** What Tab can reach in the toast layers outside `root` (none in an inert layer). */
function toastTabbable(root: HTMLElement): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(TOAST_LAYER)]
    .filter((layer) => !root.contains(layer))
    .flatMap((layer) => tabbable(layer));
}

interface ActiveTrap {
  readonly root: HTMLElement;
  /** Focuses the first focusable element, else the root itself. */
  readonly focusFirst: () => void;
}

/** The active traps, oldest first; the last one is the top. */
const traps: ActiveTrap[] = [];

/** True when the trap on `root` is the newest active one (the overlay on top, UI-WR-01 and UI-WR-02). */
export function isTopFocusTrap(root: HTMLElement | null): boolean {
  return root !== null && traps.at(-1)?.root === root;
}

/**
 * Starts trapping focus in `root` and returns the function that ends the trap. A plain function, so the effect below
 * only hands it the element (the React Compiler treats a hook's arguments, and so the element its ref points at, as
 * read-only inside the hook).
 */
function activateTrap(root: HTMLElement, initialFocus: HTMLElement | null, returnFocus: boolean): () => void {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const focusFirst = () => {
    const target = tabbable(root)[0];
    if (target !== undefined) {
      target.focus();
      return;
    }
    if (!root.hasAttribute('tabindex')) {
      root.tabIndex = -1;
    }
    root.focus();
  };

  const self: ActiveTrap = { root, focusFirst };
  // On the stack before focus moves, so a trap below ignores the focus this one takes.
  traps.push(self);
  const isTop = () => traps.at(-1) === self;

  const initial = initialFocus ?? root.querySelector<HTMLElement>(FIELD);
  if (initial === null) {
    focusFirst();
  } else {
    initial.focus();
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !isTop()) {
      return;
    }
    const items = tabbable(root);
    const first = items[0];
    const last = items.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      root.focus();
      return;
    }
    const toasts = toastTabbable(root);
    const toastFirst = toasts[0] ?? first;
    const toastLast = toasts.at(-1) ?? last;
    const current = document.activeElement;
    const outside = !root.contains(current) && !inToastLayer(root, current);
    let target: HTMLElement | null = null;
    if (event.shiftKey) {
      if (outside || current === first || current === root) {
        target = toastLast;
      } else if (current === toasts[0]) {
        target = last;
      }
    } else if (outside || current === toastLast) {
      target = first;
    } else if (current === last) {
      target = toastFirst;
    }
    if (target !== null) {
      event.preventDefault();
      target.focus();
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    if (isTop() && event.target instanceof Node && !root.contains(event.target) && !inToastLayer(root, event.target)) {
      focusFirst();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('focusin', onFocusIn);
  return () => {
    const wasTop = isTop();
    traps.splice(traps.indexOf(self), 1);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('focusin', onFocusIn);
    if (!wasTop) {
      // A trap above this one still holds focus.
      return;
    }
    if (returnFocus && trigger?.isConnected === true) {
      trigger.focus();
    }
    const below = traps.at(-1);
    if (below !== undefined && !below.root.contains(document.activeElement)) {
      below.focusFirst();
    }
  };
}

/** Traps keyboard focus inside the element `container` points at while `active`. */
export function useFocusTrap(container: RefObject<HTMLElement | null>, options: FocusTrapOptions = {}): void {
  const { active = true, initialFocus, returnFocus = true } = options;

  useEffect(() => {
    const root = container.current;
    if (!active || root === null) {
      return undefined;
    }
    return activateTrap(root, initialFocus?.current ?? null, returnFocus);
  }, [active, container, initialFocus, returnFocus]);
}
