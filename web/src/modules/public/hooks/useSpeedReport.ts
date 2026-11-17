// The consent-gated speed report (ANL-05, D-38, T-12-45). This file is in the first download, so it stays small; the
// reader (web-vitals) and the service load on demand, and only while visitor stats are allowed (PERF-01).
//   - The landing path and the latest LCP, CLS and INP are kept. When the page is hidden, one keepalive POST sends them.
//   - The hide listener is added after the reader starts, so web-vitals' own hide handlers run first and the final values are in.
//   - Nothing is sent when stats are off by then, when nothing was measured, or a second time. A failed send is dropped.
import { useEffect, useRef, useState } from 'react';
import type { VitalName } from '../speedReport';
import type { VitalsBody } from '../services/analyticsService';
import { consentStore, useConsent } from './useConsent';

type Measured = Partial<Pick<VitalsBody, 'lcp' | 'cls' | 'inp'>>;

const KEYS = { LCP: 'lcp', CLS: 'cls', INP: 'inp' } as const satisfies Record<VitalName, keyof Measured>;

const load = () => Promise.all([import('../speedReport'), import('../services/analyticsService')]);

const dropped = (): undefined => undefined;

export function useSpeedReport(pathname: string): void {
  const { statsAllowed } = useConsent();
  const [landing] = useState(pathname);
  const measured = useRef<Measured>({});
  const started = useRef(false);
  const sent = useRef(false);
  // One load per page, so React StrictMode's second effect run does not import the chunks twice.
  const loading = useRef<ReturnType<typeof load> | undefined>(undefined);
  useEffect(() => {
    if (!statsAllowed) return;
    let live = true;
    let onHide: (() => void) | undefined;
    loading.current ??= load();
    loading.current
      .then(([reader, { analyticsService }]) => {
        if (!live) return;
        if (!started.current) {
          started.current = true;
          reader.startSpeedReport((name, value) => {
            measured.current = { ...measured.current, [KEYS[name]]: value };
          });
        }
        onHide = () => {
          if (document.visibilityState !== 'hidden' || sent.current) return;
          if (Object.keys(measured.current).length === 0 || !consentStore.getSnapshot().statsAllowed) return;
          sent.current = true;
          analyticsService.vitals({ path: landing, ...measured.current }, { keepalive: true }).catch(dropped);
        };
        document.addEventListener('visibilitychange', onHide);
      })
      .catch(() => {
        loading.current = undefined;
      });
    return () => {
      live = false;
      if (onHide) document.removeEventListener('visibilitychange', onHide);
    };
  }, [statsAllowed, landing]);
}
