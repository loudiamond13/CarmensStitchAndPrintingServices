// The page-view beacon (ANL-06, D-53): one POST per new public path, sent at once with the path only. This file is in the
// first download, so it stays small; the service and the HTTP client load on demand (PERF-01). A failed send is dropped.
import { useEffect, useState } from 'react';
import type { PageViewBody } from '../services/analyticsService';

export type BeaconSend = (body: PageViewBody) => Promise<void>;

export interface BeaconMachine {
  view: (path: string) => void;
}

const dropped = (): undefined => undefined;

export function createBeaconMachine(send: BeaconSend): BeaconMachine {
  let last: string | undefined;
  return {
    view: (path) => {
      // The same path twice in a row is one view (React StrictMode runs effects twice).
      if (path === last) return;
      last = path;
      void send({ path }).catch(dropped);
    },
  };
}

const sendThroughService: BeaconSend = async (body) => {
  await (await import('../services/analyticsService')).analyticsService.pageView(body);
};

/** Admin and dev pages are never counted (the server drops them too). */
const outOfScope = /^\/(admin|dev)(\/|$)/;

export function usePageViewBeacon(pathname: string): void {
  const [machine] = useState(() => createBeaconMachine(sendThroughService));
  useEffect(() => {
    if (outOfScope.test(pathname)) return;
    machine.view(pathname);
  }, [machine, pathname]);
}
