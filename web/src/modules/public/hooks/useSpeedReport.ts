// The consent-gated speed report (ANL-05, D-38, T-12-45). This file is in the first download, so it stays small; the
// reader (web-vitals) and the service load on demand, and only while visitor stats are allowed (PERF-01).
//   - The landing path and the latest LCP, CLS and INP are kept. When the page is hidden, one keepalive POST sends them.
//   - The hide listener is added after the reader starts, so web-vitals' own hide handlers run first and the final values are in.
import { useEffect, useRef, useState } from 'react';
import type { VitalName } from '../speedReport';
import type { VitalsBody } from '../services/analyticsService';
import { useConsent } from './useConsent';

type Measured = Partial<Pick<VitalsBody, 'lcp' | 'cls' | 'inp'>>;

const KEYS = { LCP: 'lcp', CLS: 'cls', INP: 'inp' } as const satisfies Record<VitalName, keyof Measured>;

const load = () => Promise.all([import('../speedReport'), import('../services/analyticsService')]);

export function useSpeedReport(pathname: string): void {
  const { statsAllowed } = useConsent();
  const [landing] = useState(pathname);
  const measured = useRef<Measured>({});
  const started = useRef(false);
  useEffect(() => {
    if (!statsAllowed) return;
    let live = true;
    let onHide: (() => void) | undefined;
    void load().then(([reader, { analyticsService }]) => {
      if (!live) return;
      if (!started.current) {
        started.current = true;
        reader.startSpeedReport((name, value) => {
          measured.current = { ...measured.current, [KEYS[name]]: value };
        });
      }
      onHide = () => {
        if (document.visibilityState !== 'hidden') return;
        void analyticsService.vitals({ path: landing, ...measured.current }, { keepalive: true });
      };
      document.addEventListener('visibilitychange', onHide);
    });
    return () => {
      live = false;
      if (onHide) document.removeEventListener('visibilitychange', onHide);
    };
  }, [statsAllowed, landing]);
}
