// Dev-only scenario wrapper (plan 02-20; never shipped, D-20): a PasswordField in its revealed state. App. D.3 keeps
// the reveal state inside PasswordField with no prop for it, so this wrapper presses the field's toggle once after
// mount, exactly as a person would. It renders one plain block around the field and adds no look of its own; the
// reference side does the same around the frozen App. D.3 PasswordField
// (web/visual/reference/fragments/RevealPassword.tsx).
import { useEffect, useRef, type ReactNode } from 'react';

export interface RevealPasswordProps {
  /** The PasswordField node. */
  children?: ReactNode;
}

export function RevealPassword({ children }: RevealPasswordProps) {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not hide the password again.
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')?.click();
  }, []);
  return <div ref={frame}>{children}</div>;
}
