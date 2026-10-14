// Reference side of the dev-only dimmed-zero-KPI wrapper (plan 02-23, owner ruling D-39; test only, never shipped): one
// plain block around the frozen App. D.3 KpiCard. App. D.3 has no zero state, and its markup gives CSS nothing to tell a
// zero figure by, so after mount this side marks the frozen `.csp-kpi-value` with `data-zero` when the KpiCard child's
// figure is the number 0. The rulings layer's D-39 rule (`.csp-kpi-value[data-zero]`, rulings.css) then gives it
// `--ink-subtle`, the state the converted KpiCard renders by itself (web/src/dev/previews/DimmedZeroKpi.tsx). Attributes
// are not compared; the colour is. No look of its own.
import { isValidElement, useEffect, useRef, type ReactNode } from 'react';

export interface DimmedZeroKpiProps {
  children?: ReactNode;
}

export function DimmedZeroKpi({ children }: DimmedZeroKpiProps) {
  const frame = useRef<HTMLDivElement>(null);
  const zero = isValidElement<{ value?: unknown }>(children) && children.props.value === 0;
  useEffect(() => {
    for (const value of frame.current?.querySelectorAll('.csp-kpi-value') ?? []) {
      value.toggleAttribute('data-zero', zero);
    }
  }, [zero]);
  return <div ref={frame}>{children}</div>;
}
