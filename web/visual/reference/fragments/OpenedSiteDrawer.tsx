// Reference side of the dev-only opened-drawer wrapper (plan 02-26; test only, never shipped): one plain block around
// the frozen App. D.3 SiteHeader that presses its burger once after mount, the same action as the implementation side
// (web/src/dev/previews/OpenedSiteDrawer.tsx). App. D.3 keeps the drawer state inside SiteHeader with no prop for it.
// No look of its own.
import { useEffect, useRef, type ReactNode } from 'react';

export interface OpenedSiteDrawerProps {
  children?: ReactNode;
}

export function OpenedSiteDrawer({ children }: OpenedSiteDrawerProps) {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
  }, []);
  return <div ref={frame}>{children}</div>;
}
