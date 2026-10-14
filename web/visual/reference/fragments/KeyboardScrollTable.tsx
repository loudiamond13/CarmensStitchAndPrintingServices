// Reference side of the dev-only keyboard-scroll-table wrapper (plan 02-24; test only, never shipped): one plain block
// around the frozen App. D.3 DataTable. On a narrow screen App. D.3's `.csp-table-wrap` frame scrolls sideways but
// cannot take keyboard focus, which axe reports (scrollable-region-focusable, WCAG 2.1.1); the converted DataTable
// makes the frame a named, focusable region (A11Y-01). This side adds the same attributes after mount, the state the
// converted component renders by itself (web/src/dev/previews/KeyboardScrollTable.tsx). Attributes are not compared.
// No look of its own.
import { useEffect, useRef, type ReactNode } from 'react';

export interface KeyboardScrollTableProps {
  children?: ReactNode;
}

export function KeyboardScrollTable({ children }: KeyboardScrollTableProps) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (const wrap of frame.current?.querySelectorAll('.csp-table-wrap') ?? []) {
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('tabindex', '0');
      const caption = wrap.querySelector('caption')?.textContent;
      if (caption) {
        wrap.setAttribute('aria-label', caption);
      }
    }
  }, []);
  return <div ref={frame}>{children}</div>;
}
