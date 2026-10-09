// Dev-only scenario wrapper (plan 02-22; never shipped, D-20): a dialog as a person sees it right after it opens. The
// converted Modal moves focus into the dialog by itself (WEB-02, A11Y-02), so this side does nothing for focus; the
// reference side focuses the first field after mount, which the frozen App. D.3 Modal never does
// (web/visual/reference/fragments/OpenedDialog.tsx). With `typed`, both sides then type that text into the first
// input, as a person would (the ConfirmDialog type-to-confirm case). It renders one plain block around the dialog and
// adds no look of its own (the dialog is fixed, so the block has no height).
import { useEffect, useRef, type ReactNode } from 'react';
import { typeInto } from './typeInto';

export interface OpenedDialogProps {
  /** The Modal or ConfirmDialog node (or an Overlay holding one). */
  children?: ReactNode;
  /** Text to type into the first input after mount. */
  typed?: string;
}

export function OpenedDialog({ children, typed }: OpenedDialogProps) {
  const frame = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not type twice.
    if (done.current) {
      return;
    }
    done.current = true;
    const input = frame.current?.querySelector('input');
    if (typed !== undefined && input !== null && input !== undefined) {
      typeInto(input, typed);
    }
  }, [typed]);
  return <div ref={frame}>{children}</div>;
}
