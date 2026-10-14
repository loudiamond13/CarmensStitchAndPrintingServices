// Reference side of the dev-only defined-totals-note wrapper (plan 02-23; test only, never shipped): one plain block
// around the frozen App. D.3 OrderTotals. App. D.3 puts the panel's note paragraph straight inside a <dl>, which axe
// reports (definition-list); the converted OrderTotals gives that paragraph role="definition" (A11Y-01). This side adds
// the same attribute after mount, the state the converted component renders by itself
// (web/src/dev/previews/DefinedTotalsNote.tsx). Attributes are not compared. No look of its own.
import { useEffect, useRef, type ReactNode } from 'react';

export interface DefinedTotalsNoteProps {
  children?: ReactNode;
}

export function DefinedTotalsNote({ children }: DefinedTotalsNoteProps) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (const note of frame.current?.querySelectorAll('dl > p') ?? []) {
      note.setAttribute('role', 'definition');
    }
  }, []);
  return <div ref={frame}>{children}</div>;
}
