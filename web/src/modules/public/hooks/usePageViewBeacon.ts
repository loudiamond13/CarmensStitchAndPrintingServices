// The page-view beacon (ANL-05, ANL-06): one POST per public route change, the path only. This file is in the first
// download, so it stays small; the service and the HTTP client load on demand (PERF-01).
import { useEffect, useRef, useState } from 'react';
import type { PageViewBody } from '../services/analyticsService';
import { consentStore } from './useConsent';

export type BeaconSend = (body: PageViewBody, options?: { keepalive?: boolean }) => Promise<void>;

export interface BeaconView {
  landing: boolean;
  needsChoice: boolean;
  referrerHost?: string | undefined;
}

export interface BeaconMachine {
  view: (path: string, view: BeaconView) => void;
  choiceMade: () => void;
  hidden: () => void;
}

const dropped = (): undefined => undefined;

export function createBeaconMachine(send: BeaconSend): BeaconMachine {
  return {
    view: (path, { landing, referrerHost }) => {
      void send(landing && referrerHost ? { path, referrerHost } : { path }).catch(dropped);
    },
    choiceMade: dropped,
    hidden: dropped,
  };
}

const loadService = () => import('../services/analyticsService');

const sendThroughService: BeaconSend = async (body, options) => {
  await (await loadService()).analyticsService.pageView(body, options);
};

function referrerHost(): string | undefined {
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return undefined;
  }
}

export function usePageViewBeacon(pathname: string): void {
  const [machine] = useState(() => createBeaconMachine(sendThroughService));
  const first = useRef(true);
  useEffect(() => {
    const landing = first.current;
    first.current = false;
    machine.view(pathname, {
      landing,
      needsChoice: consentStore.getSnapshot().needsChoice,
      referrerHost: landing ? referrerHost() : undefined,
    });
  }, [machine, pathname]);
}
