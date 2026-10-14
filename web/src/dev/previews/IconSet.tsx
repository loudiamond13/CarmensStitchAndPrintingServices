// Dev-only scenario wrapper (plan 02-18; never shipped, D-20): holds the icons-all parity case's icons in one plain
// block, so the 56 icon wrappers flow inline as `inline-block` with `vertical-align: middle` (the .csp-icon look). It
// adds no look of its own; the reference side renders the same element (web/visual/reference/fragments/IconSet.tsx).
import type { ReactNode } from 'react';

export function IconSet({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
