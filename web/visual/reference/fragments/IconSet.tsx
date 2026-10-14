// Reference side of the dev-only icons-all wrapper (plan 02-18; test only, never shipped): one plain block that holds
// the frozen App. D.3 icons, the same element as web/src/dev/previews/IconSet.tsx. No look of its own.
import type { ReactNode } from 'react';

export function IconSet({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
