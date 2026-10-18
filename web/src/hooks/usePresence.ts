// Keeps a closing node mounted until its exit animation ends (D-38, D-39). The caller renders the node while `mounted`
// and marks it `data-state={state}`; theme keyframes do the motion. With no animation (reduced motion, jsdom) the node
// leaves in the same commit, because `animationend` never fires for `animation: none`. A 300 ms timer is the fallback
// for an animation that never ends; an `animationend` that bubbles up from a child is not the node's own and is ignored.
import { useCallback, useEffect, useRef, useState } from 'react';

/** The longest exit animation plus a margin (D-38 caps the motion at 250 ms). */
const FALLBACK_MS = 300;

export interface Presence {
  /** True while the node should be in the DOM: open, or closing and still animating. */
  readonly mounted: boolean;
  readonly state: 'open' | 'closed';
  /** A callback ref for the node that plays the exit animation. */
  readonly ref: (node: HTMLElement | null) => void;
}

export function usePresence(open: boolean): Presence {
  const [stillMounted, setStillMounted] = useState(open);
  const nodeRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  // Mounted while open, so a later close has something to animate out.
  if (open && !stillMounted) {
    setStillMounted(true);
  }

  useEffect(() => {
    const node = nodeRef.current;
    if (open) {
      return undefined;
    }
    const name = node === null ? '' : getComputedStyle(node).animationName;
    if (node === null || name === 'none' || name === '') {
      setStillMounted(false);
      return undefined;
    }
    const done = () => {
      setStillMounted(false);
    };
    const onEnd = (event: Event) => {
      if (event.target === node) {
        done();
      }
    };
    node.addEventListener('animationend', onEnd);
    const fallback = window.setTimeout(done, FALLBACK_MS);
    return () => {
      node.removeEventListener('animationend', onEnd);
      window.clearTimeout(fallback);
    };
  }, [open]);

  return { mounted: open || stillMounted, state: open ? 'open' : 'closed', ref };
}
