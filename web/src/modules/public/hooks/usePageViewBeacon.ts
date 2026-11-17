// The page-view beacon (ANL-05, ANL-06): one POST per public route change, the path only. This file is in the first
// download, so it stays small; the service and the HTTP client load on demand (PERF-01).
//   - The landing view is held while the cookie bar asks (UI-SPEC CB1 "After the choice") and sent once: on the choice,
//     on the next route change, or when the page is hidden (keepalive). Every other view is sent at once.
//   - A failed send is dropped: no retry, no message.
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
  let held: PageViewBody | undefined;
  let last: string | undefined;
  const fire = (body: PageViewBody, keepalive: boolean): void => {
    void (keepalive ? send(body, { keepalive }) : send(body)).catch(dropped);
  };
  const release = (keepalive: boolean): void => {
    const body = held;
    held = undefined;
    if (body !== undefined) fire(body, keepalive);
  };
  return {
    view: (path, { landing, needsChoice, referrerHost }) => {
      // The same path twice in a row is one view (React StrictMode runs effects twice).
      if (path === last) return;
      last = path;
      release(false);
      const body = landing && referrerHost ? { path, referrerHost } : { path };
      if (landing && needsChoice) held = body;
      else fire(body, false);
    },
    choiceMade: () => {
      release(false);
    },
    hidden: () => {
      release(true);
    },
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

/** Admin and dev pages are never counted (the server drops them too). */
const outOfScope = /^\/(admin|dev)(\/|$)/;

export function usePageViewBeacon(pathname: string): void {
  const [machine] = useState(() => createBeaconMachine(sendThroughService));
  const first = useRef(true);
  useEffect(() => {
    const unsubscribe = consentStore.subscribe(() => {
      if (!consentStore.getSnapshot().needsChoice) machine.choiceMade();
    });
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') machine.hidden();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [machine]);
  useEffect(() => {
    const landing = first.current;
    first.current = false;
    if (outOfScope.test(pathname)) return;
    const { needsChoice } = consentStore.getSnapshot();
    // A held view may have to leave while the page closes, so the service is already loaded by then.
    if (landing && needsChoice) void loadService().catch(dropped);
    machine.view(pathname, { landing, needsChoice, referrerHost: landing ? referrerHost() : undefined });
  }, [machine, pathname]);
}
