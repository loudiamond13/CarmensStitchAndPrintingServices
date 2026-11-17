// The one consent state for the public layout (ANL-01, ANL-07, D-16, D-17, D-22, D-34). A small external store over the
// saved cookie, read with useSyncExternalStore. The state is worked out again only when this store changes the cookie, so
// the snapshot stays the same object between changes.
//   - Before a choice nothing is written and nothing is sent (ANL-01). With no cookie the answer needs no rules at all:
//     the bar is needed (unless the browser sends GPC), so a first visit loads nothing here.
//   - With a cookie, the rules (consentRules.ts: version, day and 12-month checks) load as their own chunk and the state
//     is worked out again. Until then the saved choice is trusted (no bar), so a returning visitor sees no flash; a stale
//     choice shows the bar once the rules arrive.
//   - A choice goes through consentSave.ts, loaded only when one is made. It writes a provisional cookie (pending
//     marker), applies the choice at once, then sends it to the server. The server sets the real cookie; this store
//     never writes the confirmed cookie itself.
//   - The first download holds this file and the cookie reader only (PERF-01).
import { useSyncExternalStore } from 'react';
import type { ConsentCookie } from '../consentCookie';
import { readConsentCookie } from '../consentJar';
import type { SaveHost, SendMemory } from '../consentSave';
import type { ConsentService, ConsentSource } from '../services/consentService';

export type { ConsentSource } from '../services/consentService';

/** The polite status after a choice. */
export const CONSENT_SAVED_LINE = 'Your cookie choice is saved.';

export interface ConsentState {
  /** The saved cookie as read, whether or not it still counts. Null until the rules have loaded when a cookie exists. */
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
  acceptAll: (source: ConsentSource) => Promise<void>;
  rejectAll: (source: ConsentSource) => Promise<void>;
  save: (choice: ConsentChoice, source: ConsentSource) => Promise<void>;
  /** Saves only the map part (D-18); the stats part stays as it was or unchosen. */
  allowMaps: () => Promise<void>;
  openSettings: (opener?: HTMLElement) => void;
  closeSettings: () => void;
  /** Sends a provisional choice again once, when an earlier send failed. */
  resendPending: () => Promise<void>;
}

export interface ConsentStoreOptions {
  /** The consent cookie value, or undefined. */
  readCookie: () => string | undefined;
  /** Writes the provisional consent cookie, or removes the cookie with null. The default writes document.cookie. */
  writeCookie?: (value: string | null) => void;
  gpc: boolean;
  /** The Asia/Manila business day as YYYY-MM-DD. */
  today?: () => string;
  currentVersion?: string;
  loadService?: () => Promise<ConsentService>;
  newConsentId?: () => string;
}

export interface ConsentStore extends ConsentActions {
  getSnapshot: () => ConsentState;
  subscribe: (listener: () => void) => () => void;
  /** Tests only: points the store at another jar and clears what it remembers. */
  reconfigure: (options: ConsentStoreOptions) => void;
}

type Rules = typeof import('../consentRules');

const freshMemory = (): SendMemory => ({ inFlight: false, answeredValue: undefined, lastSource: 'bar' });

export function createConsentStore(initial: ConsentStoreOptions): ConsentStore {
  let options = initial;
  let rules: Rules | undefined;
  let rulesLoading = false;
  let settingsOpen = false;
  let serverGpc = false;
  // The choice written this page, kept in memory too, so a browser that will not store the cookie still closes the bar for this page.
  let held: string | undefined;
  let memory: SendMemory = freshMemory();
  let settingsOpener: HTMLElement | undefined;
  let announcement: string | null = null;
  const listeners = new Set<() => void>();

  function compute(raw: string | undefined): ConsentState {
    const gpc = options.gpc || serverGpc;
    const shared = { gpc, settingsOpen, announcement };
    if (rules === undefined) {
      return {
        ...shared,
        cookie: null,
        needsChoice: raw === undefined && !gpc,
        statsAllowed: false,
        mapAllowed: false,
      };
    }
    return { ...shared, ...rules.deriveConsent(raw, { ...options, gpc }) };
  }

  const read = (): string | undefined => options.readCookie() ?? held;

  function update(): void {
    const raw = read();
    state = compute(raw);
    if (raw !== undefined && rules === undefined && !rulesLoading) {
      rulesLoading = true;
      void import('../consentRules').then((module) => {
        rules = module;
        update();
        notify();
      });
    }
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function refresh(): void {
    update();
    notify();
  }

  let state: ConsentState = compute(undefined);
  update();

  const host: SaveHost = {
    options: () => options,
    read,
    hold: (value) => {
      held = value;
    },
    memory: () => memory,
    announce: (line) => {
      announcement = line;
    },
    markGpc: () => {
      serverGpc = true;
    },
    refresh,
  };

  const loadSave = () => import('../consentSave');

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reconfigure: (next) => {
      options = next;
      settingsOpen = false;
      settingsOpener = undefined;
      announcement = null;
      serverGpc = false;
      held = undefined;
      memory = freshMemory();
      refresh();
    },
    acceptAll: async (source) => {
      await (await loadSave()).commitChoice(host, { stats: true, map: true }, source, CONSENT_SAVED_LINE);
    },
    rejectAll: async (source) => {
      await (await loadSave()).commitChoice(host, { stats: false, map: false }, source, CONSENT_SAVED_LINE);
    },
    save: async (choice, source) => {
      await (await loadSave()).commitChoice(host, choice, source, CONSENT_SAVED_LINE);
    },
    allowMaps: async () => {
      const save = await loadSave();
      await save.commitChoice(host, save.mapOnlyChoice(host), 'map-link', null);
    },
    openSettings: (opener) => {
      settingsOpener = opener;
      settingsOpen = true;
      refresh();
    },
    closeSettings: () => {
      settingsOpen = false;
      refresh();
      if (settingsOpener?.isConnected === true) settingsOpener.focus();
    },
    resendPending: async () => {
      // A pending cookie ends in _p, so a visitor with none loads nothing here.
      if (read()?.endsWith('_p') !== true) return;
      await (await loadSave()).resendChoice(host);
    },
  };
}

export const consentStore: ConsentStore = createConsentStore({
  readCookie: () => (typeof document === 'undefined' ? undefined : readConsentCookie(document.cookie)),
  gpc:
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
});

export function resetConsentStore(next: ConsentStoreOptions): void {
  consentStore.reconfigure(next);
}

const ACTIONS: ConsentActions = {
  acceptAll: consentStore.acceptAll,
  rejectAll: consentStore.rejectAll,
  save: consentStore.save,
  allowMaps: consentStore.allowMaps,
  openSettings: consentStore.openSettings,
  closeSettings: consentStore.closeSettings,
  resendPending: consentStore.resendPending,
};

export function useConsent(): ConsentState & ConsentActions {
  'use no memo';
  const state = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getSnapshot);
  return { ...state, ...ACTIONS };
}
