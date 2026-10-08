// SPEC-GAP: LoadingRegion (02-UI-SPEC SPEC-GAP "Skeleton family + LoadingRegion"; WEB-06, A11Y-01, PRD section 12).
// The region gets aria-busy="true" while it loads, and one visually hidden polite status node says "Loading {things}…"
// and then "{Things} loaded.". The status node is a sibling of the busy region, not inside it, because assistive tech
// may hold back announcements from inside a busy subtree.
import { clsx } from 'clsx';
import { useState, type ReactNode } from 'react';
import { LIST_COPY } from './copy';

export interface LoadingRegionProps {
  /** True while the first load or a slow refetch runs. */
  busy: boolean;
  /** The plural noun the announcements use, like "orders". */
  things: string;
  failed?: boolean;
  children?: ReactNode;
  /** On the busy region. */
  className?: string;
}

type Phase = 'idle' | 'loading' | 'loaded';

export function LoadingRegion({ busy, things, children, className }: LoadingRegionProps) {
  const [phase, setPhase] = useState<Phase>(busy ? 'loading' : 'idle');
  const [wasBusy, setWasBusy] = useState(busy);
  // Track the busy edges during render, so the announcement changes in the same render as aria-busy.
  if (busy !== wasBusy) {
    setWasBusy(busy);
    setPhase(busy ? 'loading' : 'loaded');
  }
  const message = phase === 'loading' ? LIST_COPY.loading(things) : phase === 'loaded' ? LIST_COPY.loaded(things) : '';
  return (
    <>
      <div className={clsx(className)} aria-busy={busy || undefined}>
        {children}
      </div>
      <div role="status" aria-live="polite" className="csp-sr">
        {message}
      </div>
    </>
  );
}
