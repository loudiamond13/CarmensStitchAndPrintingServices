// True while the element's content is taller than its box, so the caller can make it a keyboard-scrollable region
// (axe scrollable-region-focusable, WCAG 2.1.1). It measures when it starts and whenever the element, one of its
// children, or the list of children changes. Without ResizeObserver (jsdom) it measures once.
import { useEffect, useState, type RefObject } from 'react';

export function useScrollsVertically(ref: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!active || node === null) return;
    const measure = () => {
      setScrolls(node.scrollHeight > node.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const resizes = new ResizeObserver(measure);
    const observeAll = () => {
      resizes.disconnect();
      resizes.observe(node);
      for (const child of node.children) resizes.observe(child);
    };
    observeAll();
    const additions = new MutationObserver(() => {
      observeAll();
      measure();
    });
    additions.observe(node, { childList: true });
    return () => {
      resizes.disconnect();
      additions.disconnect();
    };
  }, [ref, active]);
  return scrolls;
}
