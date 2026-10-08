// Reference side of the dev-only revealed-password wrapper (plan 02-20; test only, never shipped): one plain block
// around the frozen App. D.3 PasswordField whose toggle is pressed once after mount, the same element and the same
// action as web/src/dev/previews/RevealPassword.tsx. No look of its own.
import { useEffect, useRef, type ReactNode } from 'react';

export interface RevealPasswordProps {
  children?: ReactNode;
}

export function RevealPassword({ children }: RevealPasswordProps) {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')?.click();
  }, []);
  return <div ref={frame}>{children}</div>;
}
