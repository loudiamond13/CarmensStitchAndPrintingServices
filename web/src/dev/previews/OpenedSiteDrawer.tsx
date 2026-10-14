// Dev-only scenario wrapper (plan 02-26; never shipped, D-20): the public header with its phone drawer open. App. D.3
// keeps the drawer state inside SiteHeader with no prop for it, so this wrapper presses the burger once after mount,
// exactly as a person would. It renders one plain block around the header and adds no look of its own; the reference
// side does the same around the frozen App. D.3 SiteHeader (web/visual/reference/fragments/OpenedSiteDrawer.tsx).
import { useEffect, useRef, type ReactNode } from 'react';

export interface OpenedSiteDrawerProps {
  /** The SiteHeader node. */
  children?: ReactNode;
}

export function OpenedSiteDrawer({ children }: OpenedSiteDrawerProps) {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not close the drawer again.
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
  }, []);
  return <div ref={frame}>{children}</div>;
}
