// The one consent state for the public layout (ANL-01, ANL-07, D-16, D-17, D-22, D-34). A small external store over the
// saved cookie, read with useSyncExternalStore. The state is worked out again only when this store changes the cookie, so
// the snapshot stays the same object between changes.
//   - Before a choice nothing is written and nothing is sent (ANL-01).
//   - A choice is written at once as a provisional cookie (pending marker), applied in this browser, and then sent to
//     the server through a dynamic import, so the service and the HTTP client load only when a choice is made (PERF-01).
//   - The server answers by setting the real cookie; this file never writes the confirmed cookie itself.
//   - `today` is the Asia/Manila business day, never the device date (D-43).
import { useSyncExternalStore } from 'react';
import {
  CONSENT_COOKIE_NAME,
  formatConsentCookie,
  isCurrentChoice,
  needsChoice,
  parseConsentCookie,
  readConsentCookie,
  type ConsentCookie,
} from '../consentCookie';
import { CONSENT_COPY } from '../consentCopy';
import { LEGAL_PAGES } from '../legalPages';
import type { ConsentRecordBody, ConsentService, ConsentSource } from '../services/consentService';

export type { ConsentSource } from '../services/consentService';

export interface ConsentState {
  /** The saved cookie as read, whether or not it still counts. */
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
  /** Writes the provisional consent cookie, or removes the cookie with null. */
  writeCookie: (value: string | null) => void;
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

const BUSINESS_ZONE = 'Asia/Manila';
const LIFETIME_SECONDS = 365 * 24 * 60 * 60;

/** The business day (Asia/Manila) of an instant as YYYY-MM-DD; the same day the server stamps on the cookie. */
export function manilaBusinessDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The `Set-Cookie` text for the provisional cookie, or for its removal (null): `__Host-` rules, 12 months. */
export function consentCookieText(value: string | null): string {
  const attributes = `Path=/; Secure; SameSite=Lax; Max-Age=${String(value === null ? 0 : LIFETIME_SECONDS)}`;
  return `${CONSENT_COOKIE_NAME}=${value ?? ''}; ${attributes}`;
}

function randomConsentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function loadConsentService(): Promise<ConsentService> {
  return import('../services/consentService').then((module) => module.consentService);
}

export function createConsentStore(initial: ConsentStoreOptions): ConsentStore {
  let options = initial;
  let settingsOpen = false;
  let settingsOpener: HTMLElement | undefined;
  let announcement: string | null = null;
  const listeners = new Set<() => void>();

  const today = (): string => (options.today ?? (() => manilaBusinessDay(new Date())))();
  const version = (): string => options.currentVersion ?? LEGAL_PAGES.cookies.version;

  function compute(): ConsentState {
    const cookie = parseConsentCookie(options.readCookie());
    const checks = { currentVersion: version(), today: today() };
    const current = cookie !== null && isCurrentChoice(cookie, checks);
    return {
      cookie,
      gpc: options.gpc,
      needsChoice: needsChoice(cookie, { ...checks, gpc: options.gpc }),
      statsAllowed: !options.gpc && current && cookie.stats === true,
      mapAllowed: current && cookie.map,
      settingsOpen,
      announcement,
    };
  }

  let state = compute();

  function refresh(): void {
    state = compute();
    for (const listener of listeners) listener();
  }

  async function send(body: ConsentRecordBody): Promise<void> {
    try {
      const service = await (options.loadService ?? loadConsentService)();
      await service.record(body);
      refresh();
    } catch {
      // The choice already applies in this browser; a failed send is never shown to the visitor.
    }
  }

  async function commit(choice: ConsentChoice, source: ConsentSource, announce: boolean): Promise<void> {
    const prior = state.cookie;
    const stats = options.gpc && choice.stats === true ? false : choice.stats;
    const decision: ConsentCookie = {
      consentId: prior?.consentId ?? (options.newConsentId ?? randomConsentId)(),
      policyVersion: version(),
      stats,
      map: choice.map,
      decidedOn: today(),
      pending: true,
    };
    options.writeCookie(formatConsentCookie(decision));
    if (announce) announcement = CONSENT_COPY.saved;
    refresh();
    await send({
      ...(prior === null ? {} : { consentId: prior.consentId }),
      policyVersion: decision.policyVersion,
      stats,
      map: choice.map,
      source,
    });
  }

  const store: ConsentStore = {
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
      refresh();
    },
    acceptAll: (source) => commit({ stats: true, map: true }, source, true),
    rejectAll: (source) => commit({ stats: false, map: false }, source, true),
    save: (choice, source) => commit(choice, source, true),
    allowMaps: () => {
      const current =
        state.cookie !== null && isCurrentChoice(state.cookie, { currentVersion: version(), today: today() });
      return commit({ stats: current ? (state.cookie?.stats ?? null) : null, map: true }, 'map-link', false);
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
    resendPending: () => Promise.resolve(),
  };
  return store;
}

export const consentStore: ConsentStore = createConsentStore({
  readCookie: () => (typeof document === 'undefined' ? undefined : readConsentCookie(document.cookie)),
  writeCookie: (value) => {
    // The only document.cookie write on the public site before the server answers (ANL-01).
    document.cookie = consentCookieText(value);
  },
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
  const state = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getSnapshot);
  return { ...state, ...ACTIONS };
}
