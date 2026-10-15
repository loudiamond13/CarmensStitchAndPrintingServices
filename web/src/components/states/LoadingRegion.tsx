// SPEC-GAP: LoadingRegion (UI-SPEC "SPEC-GAP Primitive Specs" → Skeleton family + LoadingRegion; WEB-06, A11Y-01, PRD
// section 12). The region gets aria-busy while it loads, and one visually hidden polite status node says
// "Loading {things}…" and then "{Things} loaded." (Copywriting "Loading announcement"). The status node is a sibling
// of the busy region, not inside it, because assistive tech may hold back announcements from inside a busy subtree.
import { useState, type ReactNode } from 'react';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { STATES_COPY } from './copy';

export interface LoadingRegionProps {
  /** True while the first load or a slow refetch runs. */
  loading: boolean;
  /** The plural noun the announcements use, like "orders". */
  things: string;
  /**
   * The load that just ended failed. The status then says nothing, because the ErrorState banner (an alert)
   * announces the failure itself.
   */
  failed?: boolean | undefined;
  /** Own words for the two announcements, for a screen whose copy is not "Loading {things}…" (the reset link check). */
  announce?: { readonly loading: string; readonly loaded: string } | undefined;
  children?: ReactNode;
  /** Layout glue only, on the busy region. */
  className?: string | undefined;
}

type Phase = 'idle' | 'loading' | 'loaded' | 'failed';

export function LoadingRegion({ loading, things, failed = false, announce, children, className }: LoadingRegionProps) {
  const [phase, setPhase] = useState<Phase>(loading ? 'loading' : 'idle');
  const [wasLoading, setWasLoading] = useState(loading);
  // Track the loading edges during render, so the announcement changes in the same render as aria-busy.
  if (loading !== wasLoading) {
    setWasLoading(loading);
    setPhase(loading ? 'loading' : failed ? 'failed' : 'loaded');
  }
  const message =
    phase === 'loading'
      ? (announce?.loading ?? STATES_COPY.loading.loading(things))
      : phase === 'loaded'
        ? (announce?.loaded ?? STATES_COPY.loading.loaded(things))
        : '';
  return (
    <>
      <div className={className} aria-busy={loading || undefined}>
        {children}
      </div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {message}
      </div>
    </>
  );
}
