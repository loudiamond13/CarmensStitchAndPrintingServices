// The mount point for the cookie bar and the Cookie Settings window (ANL-01, ANL-03, PERF-01). It is in the public first
// download and holds only the store read: the bar loads as its own chunk, and only while a choice is needed, and the window
// as its own chunk, and only while it is open, so a visitor who never opens either never downloads them. It also holds the
// visually hidden polite status that says the choice is saved (A11Y-02).
import { lazy, Suspense } from 'react';
import { useConsent } from '../hooks/useConsent';

const ConsentBar = lazy(() => import('./ConsentBar').then((module) => ({ default: module.ConsentBar })));
const CookieSettingsDialog = lazy(() =>
  import('./CookieSettingsDialog').then((module) => ({ default: module.CookieSettingsDialog })),
);

export function ConsentSlot() {
  'use no memo';
  const { needsChoice, settingsOpen, announcement } = useConsent();
  return (
    <>
      {needsChoice && (
        <Suspense fallback={null}>
          <ConsentBar />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <CookieSettingsDialog />
        </Suspense>
      )}
      {/* A polite live region that is always there, so a screen reader hears the change. It is not role="status": pages name their own status lines by that role. */}
      <div aria-live="polite" data-consent-status className="sr-only">
        {announcement}
      </div>
    </>
  );
}
