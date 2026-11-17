// The mount point for the cookie bar (ANL-01, PERF-01). It is in the public first download and holds only the store read:
// the bar loads as its own chunk, and only while a choice is needed, so a visitor who has chosen never downloads it. It
// also holds the visually hidden polite status that says the choice is saved (A11Y-02). Plan 12-13 mounts the settings
// window here as well.
import { lazy, Suspense } from 'react';
import { useConsent } from '../hooks/useConsent';

const ConsentBar = lazy(() => import('./ConsentBar').then((module) => ({ default: module.ConsentBar })));

export function ConsentSlot() {
  'use no memo';
  const { needsChoice, announcement } = useConsent();
  return (
    <>
      {needsChoice && (
        <Suspense fallback={null}>
          <ConsentBar />
        </Suspense>
      )}
      {/* A polite live region that is always there, so a screen reader hears the change. It is not role="status": pages name their own status lines by that role. */}
      <div aria-live="polite" data-consent-status className="sr-only">
        {announcement}
      </div>
    </>
  );
}
