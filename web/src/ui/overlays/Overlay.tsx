// RED stub (plan 02-22 Task 1).
import type { ReactNode } from 'react';

export interface OverlayProps {
  children?: ReactNode;
}

export function Overlay({ children }: OverlayProps) {
  return <div>{children}</div>;
}
