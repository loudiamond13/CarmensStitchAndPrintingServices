// Dev-only scenario wrapper (plan 02-23, owner ruling D-39; never shipped, D-20): one plain block around a KpiCard whose
// figure is zero. The converted KpiCard dims a zero figure by itself (`text-ink-subtle`, colour only), so this side does
// nothing. App. D.3 has no zero state, so the reference side marks the frozen value with `data-zero` after mount and the
// rulings layer's D-39 rule colours it (web/visual/reference/fragments/DimmedZeroKpi.tsx); attributes are not compared.
// It adds no look of its own.
import type { ReactNode } from 'react';

export interface DimmedZeroKpiProps {
  /** The KpiCard node. */
  children?: ReactNode;
}

export function DimmedZeroKpi({ children }: DimmedZeroKpiProps) {
  return <div>{children}</div>;
}
