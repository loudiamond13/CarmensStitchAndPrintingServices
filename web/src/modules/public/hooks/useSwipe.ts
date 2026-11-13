// useSwipe (UI-SPEC G2 "Swipe", C-35): a horizontal pointer move of at least `minDistance` pixels (48 by default) that is more
// horizontal than vertical, read from the pointer down and up on the element. A move to the left calls `onLeft`, to the right
// `onRight`. The click that the browser may send after a swipe is swallowed, so a swipe that starts on a button never presses it.
// The element should carry `touch-action: pan-y`, so the browser keeps the vertical scroll and hands the horizontal move over.
import { useEffect, useEffectEvent, type RefObject } from 'react';

export interface SwipeOptions {
  onLeft: () => void;
  onRight: () => void;
  /** The shortest move that counts, in pixels (default 48). */
  minDistance?: number;
}

/** How long after a swipe a click is still taken as part of it, in milliseconds. */
const CLICK_WINDOW_MS = 100;

export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  { onLeft, onRight, minDistance = 48 }: SwipeOptions,
): void {
  const left = useEffectEvent(onLeft);
  const right = useEffectEvent(onRight);
  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    let start: { id: number; x: number; y: number } | null = null;

    const swallowClick = () => {
      const stop = (event: Event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      element.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => {
        element.removeEventListener('click', stop, { capture: true });
      }, CLICK_WINDOW_MS);
    };
    const onDown = (event: PointerEvent) => {
      start = event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event: PointerEvent) => {
      if (start?.id !== event.pointerId) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) < minDistance || Math.abs(dx) <= Math.abs(dy)) {
        return;
      }
      swallowClick();
      if (dx < 0) {
        left();
      } else {
        right();
      }
    };
    const onCancel = () => {
      start = null;
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
    };
  }, [ref, minDistance]);
}
