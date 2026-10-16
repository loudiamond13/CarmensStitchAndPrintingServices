// Makes the page behind an open dialog inert (R2-10; the scoped axe workaround of plan 02-35 retires with it).
// While a dialog is open, every element outside it gets the `inert` attribute, so the keyboard, assistive technology and
// axe all treat the page behind it as unavailable. The walk goes from the dialog up to the body and marks each sibling
// along the way, so the dialog and its ancestors stay live; the toast layer (`data-ui="s-toast-layer"`) stays live too,
// because a failed save is reported there (UI-WR-03).
// Only the newest open dialog decides: dialogs stack, the newest one is the live one, and the older ones are outside it.
// When it closes, the set is recomputed for the dialog below it, or cleared. An element that was already inert for
// another reason (the phone drawer's frame) is never touched, so it stays inert afterwards.
// The page is marked after the focus trap has captured its trigger, and unmarked before the trap returns focus to it
// (an inert trigger cannot take focus): see Modal's hook order and the layout effect below.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** The toast layer ToastProvider renders. */
const TOAST_LAYER = '[data-ui="s-toast-layer"]';

/** Elements that never render in the page, so there is nothing to make inert. */
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);

/** The open dialogs, oldest first; the last one is live. */
const stack: HTMLElement[] = [];

/** The elements this module made inert. */
const applied = new Set<Element>();

/** Adds what to mark inside `element` (a sibling of the path): all of it, unless a toast layer lives in it. */
function collectSubtree(element: Element, into: Set<Element>): void {
  if (SKIPPED.has(element.tagName) || element.matches(TOAST_LAYER)) {
    return;
  }
  if (element.querySelector(TOAST_LAYER) === null) {
    into.add(element);
    return;
  }
  for (const child of element.children) {
    collectSubtree(child, into);
  }
}

/** Everything outside `dialog` that should be inert: the siblings of the dialog and of each ancestor, up to the body. */
function outsideOf(dialog: HTMLElement): Set<Element> {
  const outside = new Set<Element>();
  let node: Element = dialog;
  while (node !== document.body && node.parentElement !== null) {
    const parent: Element = node.parentElement;
    for (const sibling of parent.children) {
      if (sibling !== node) {
        collectSubtree(sibling, outside);
      }
    }
    node = parent;
  }
  return outside;
}

/** Brings the inert elements in line with the newest open dialog. */
function sync(): void {
  const top = stack.at(-1);
  const wanted = top === undefined ? new Set<Element>() : outsideOf(top);
  for (const element of [...applied]) {
    if (!wanted.has(element)) {
      element.removeAttribute('inert');
      applied.delete(element);
    }
  }
  for (const element of wanted) {
    if (!applied.has(element) && !element.hasAttribute('inert')) {
      element.setAttribute('inert', '');
      applied.add(element);
    }
  }
}

function join(dialog: HTMLElement): void {
  stack.push(dialog);
  sync();
}

function leave(dialog: HTMLElement): void {
  const index = stack.indexOf(dialog);
  if (index !== -1) {
    stack.splice(index, 1);
  }
  sync();
}

/** Makes everything outside the element `container` points at inert while `active`. */
export function useInertOutside(container: RefObject<HTMLElement | null>, active: boolean): void {
  const joined = useRef<HTMLElement | null>(null);

  // After the focus trap has taken its trigger (declare this hook after useFocusTrap).
  useEffect(() => {
    const root = container.current;
    if (!active || root === null) {
      return;
    }
    joined.current = root;
    join(root);
  }, [active, container]);

  // A layout cleanup runs before any passive cleanup, so the page is live again when the trap returns focus to it.
  useLayoutEffect(
    () => () => {
      const root = joined.current;
      if (root !== null) {
        joined.current = null;
        leave(root);
      }
    },
    [active, container],
  );
}
