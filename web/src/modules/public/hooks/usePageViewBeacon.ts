// The page-view beacon (ANL-05, ANL-06): one POST per public route change, the path only.
import type { PageViewBody } from '../services/analyticsService';

export type BeaconSend = (body: PageViewBody, options?: { keepalive?: boolean }) => Promise<void>;

export interface BeaconView {
  landing: boolean;
  needsChoice: boolean;
  referrerHost?: string;
}

export interface BeaconMachine {
  view: (path: string, view: BeaconView) => void;
  choiceMade: () => void;
  hidden: () => void;
}

export function createBeaconMachine(send: BeaconSend): BeaconMachine {
  void send;
  return {
    view: () => undefined,
    choiceMade: () => undefined,
    hidden: () => undefined,
  };
}

export function usePageViewBeacon(pathname: string): void {
  void pathname;
}
