// Dev-only scenario wrapper (plan 12-29; never shipped, D-20): the cookie bar (CB1) in the Blush public look, drawn in the
// page flow so it sits inside its case frame instead of at the bottom of the window. The bar keeps its own classes; only its
// position is set to static here. The shared consent store is seeded with no choice and a stand-in service, so pressing a
// button there sends nothing.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { ConsentBar } from '@/modules/public/components/ConsentBar';
import { restoreDemoConsent, seedDemoConsent } from './demoConsent';

export function StaticConsentBar() {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = box.current?.querySelector<HTMLElement>('[data-consent-bar]');
    if (bar !== null && bar !== undefined) bar.style.position = 'static';
  }, []);
  useEffect(() => {
    seedDemoConsent('no-choice');
    return restoreDemoConsent;
  }, []);
  return (
    <div ref={box} data-theme="light">
      <ConsentBar />
    </div>
  );
}
