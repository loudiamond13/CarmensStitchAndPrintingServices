// Keeps one focusable element per row id, so a screen can move focus back to a row's button after a dialog or panel closes
// (UI-SPEC Interaction Contract, "Focus after list changes"). The registry lives in a ref inside the hook.
import { useCallback, useRef } from 'react';

export function useRowFocus() {
  const elements = useRef(new Map<string, HTMLElement>());

  /** A ref callback target: remembers the element for the row, or forgets it when the row goes away. */
  const register = useCallback((id: string, element: HTMLElement | null): void => {
    if (element === null) {
      elements.current.delete(id);
    } else {
      elements.current.set(id, element);
    }
  }, []);

  /** Focuses the row's element; false when the row has none (it left the list). */
  const focusRow = useCallback((id: string): boolean => {
    const element = elements.current.get(id);
    element?.focus();
    return element !== undefined;
  }, []);

  return { register, focusRow };
}
