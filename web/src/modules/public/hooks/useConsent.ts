// The one consent state for the public layout (ANL-01, ANL-07, D-16, D-17, D-22, D-34).
import { useSyncExternalStore } from 'react';
import type { ConsentCookie } from '../consentCookie';
import type { ConsentService, ConsentSource } from '../services/consentService';

export type { ConsentSource } from '../services/consentService';

export interface ConsentState {
  cookie: ConsentCookie | null;
  gpc: boolean;
  needsChoice: boolean;
  statsAllowed: boolean;
  mapAllowed: boolean;
  settingsOpen: boolean;
  announcement: string | null;
}

export interface ConsentChoice {
  stats: boolean | null;
  map: boolean;
}

export interface ConsentActions {
  acceptAll(source: ConsentSource): Promise<void>;
  rejectAll(source: ConsentSource): Promise<void>;
  save(choice: ConsentChoice, source: ConsentSource): Promise<void>;
  allowMaps(): Promise<void>;
  openSettings(opener?: HTMLElement): void;
  closeSettings(): void;
  resendPending(): Promise<void>;
}

export interface ConsentStoreOptions {
  readCookie: () => string | undefined;
  writeCookie: (value: string | null) => void;
  gpc: boolean;
  today?: () => string;
  currentVersion?: string;
  loadService?: () => Promise<ConsentService>;
  newConsentId?: () => string;
}

export interface ConsentStore extends ConsentActions {
  getSnapshot(): ConsentState;
  subscribe(listener: () => void): () => void;
  reconfigure(options: ConsentStoreOptions): void;
}

export function manilaBusinessDay(_now: Date): string {
  return '';
}

const STUB_STATE: ConsentState = {
  cookie: null,
  gpc: false,
  needsChoice: false,
  statsAllowed: false,
  mapAllowed: false,
  settingsOpen: false,
  announcement: null,
};

export function createConsentStore(_options: ConsentStoreOptions): ConsentStore {
  const noop = () => Promise.resolve();
  return {
    getSnapshot: () => STUB_STATE,
    subscribe: () => () => undefined,
    reconfigure: () => undefined,
    acceptAll: noop,
    rejectAll: noop,
    save: noop,
    allowMaps: noop,
    openSettings: () => undefined,
    closeSettings: () => undefined,
    resendPending: noop,
  };
}

export const consentStore: ConsentStore = createConsentStore({
  readCookie: () => undefined,
  writeCookie: () => undefined,
  gpc: false,
});

export function resetConsentStore(options: ConsentStoreOptions): void {
  consentStore.reconfigure(options);
}

export function useConsent(): ConsentState & ConsentActions {
  const state = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getSnapshot);
  return { ...state, ...consentStore };
}
