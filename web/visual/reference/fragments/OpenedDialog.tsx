// Reference side of the dev-only opened-dialog wrapper (plan 02-22; test only, never shipped): one plain block around
// the frozen App. D.3 dialog. The frozen Modal never moves focus, so this side focuses the first field after mount, the
// state the converted Modal opens in by itself (web/src/dev/previews/OpenedDialog.tsx); with `typed`, it then types
// that text into the first input, the same action as the implementation side. No look of its own.
import { useEffect, useRef, type ReactNode } from 'react';

export interface OpenedDialogProps {
  children?: ReactNode;
  typed?: string;
}

export function OpenedDialog({ children, typed }: OpenedDialogProps) {
  const frame = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) {
      return;
    }
    done.current = true;
    frame.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    const input = frame.current?.querySelector('input');
    if (typed !== undefined && input !== null && input !== undefined) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, typed);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, [typed]);
  return <div ref={frame}>{children}</div>;
}
