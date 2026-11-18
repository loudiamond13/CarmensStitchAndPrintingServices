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

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

/** The polite status after a choice. */
export const CONSENT_SAVED_LINE = 'Your cookie choice is saved.';

export interface ConsentState {
  /** The saved cookie as read, whether or not it still counts. Null until the rules have loaded when a cookie exists. */
  cookie: ConsentCookie | null;
  /** The saved cookie still counts (its version, day and age). False until the rules have loaded. */
  current: boolean;
  gpc: boolean;
  needsChoice: boolean;
  statsAllowed: boolean;
  mapAllowed: boolean;
  settingsOpen: boolean;
  /** True from the first open of the settings window until its chunk has mounted (the opener shows it pending). */
  settingsLoading: boolean;
  announcement: string | null;
  /** How many saved choices on this page turned the map off. A map shown for one tap is unloaded when it rises. */
  mapRefusals: number;
}

/** How a clear ended: done, refused by the rate limit (429), or any other failure. */
export type ClearOutcome = 'cleared' | 'failed' | 'rate-limited';

/** The readable cookies this site sets that are not essential, expired by name on a clear. None today: the map's cookies are Google's. */
const NON_ESSENTIAL_COOKIES: readonly string[] = [];

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
  /** The settings window has mounted: the opener stops showing pending. */
  settingsReady: () => void;
  /** Sends a provisional choice again once, when an earlier send failed. */
  resendPending: () => Promise<void>;
  /**
   * Clear my cookies and data (ANL-04, D-19, D-31): the server call runs first. Only after it answers 2xx does this browser forget
   * its storage and non-essential cookies, and the consent cookie the server set (stats off, map off) becomes the choice.
   */
  clearData: () => Promise<ClearOutcome>;
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

const freshMemory = (): SendMemory => ({
  inFlight: 0,
  chain: Promise.resolve(),
  answeredValue: undefined,
  lastSource: 'bar',
});

const loadConsentService = (): Promise<ConsentService> =>
  import('../services/consentService').then((module) => module.consentService);

const isRateLimited = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 429;

/** Forgets what this site keeps in this browser. Storage that cannot be reached (a locked-down browser) holds nothing to forget. */
function forgetBrowserData(): void {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Blocked storage has nothing of ours in it.
  }
  for (const name of NON_ESSENTIAL_COOKIES) document.cookie = `${name}=; Path=/; Max-Age=0`;
}

export function createConsentStore(initial: ConsentStoreOptions): ConsentStore {
  let options = initial;
  let rules: Rules | undefined;
  let rulesLoading = false;
  let settingsOpen = false;
  let settingsLoading = false;
  let windowReady = false;
  let serverGpc = false;
  // The choice written this page, kept in memory too, so a browser that will not store the cookie still closes the bar for this page.
  let held: string | undefined;
  let mapRefusals = 0;
  let memory: SendMemory = freshMemory();
  let settingsOpener: HTMLElement | undefined;
  let announcement: string | null = null;
  const listeners = new Set<() => void>();

  function compute(raw: string | undefined): ConsentState {
    const gpc = options.gpc || serverGpc;
    const shared = { gpc, settingsOpen, settingsLoading, announcement, mapRefusals };
    if (rules === undefined) {
      return {
        ...shared,
        cookie: null,
        current: false,
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
    choseMap: (map) => {
      if (!map) mapRefusals += 1;
    },
    memory: () => memory,
    // A repeat of the same line gets a trailing no-break space, so the live region's text changes and is read again.
    announce: (line) => {
      announcement = line !== null && line === announcement ? line + NO_BREAK_SPACE : line;
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
      settingsLoading = false;
      windowReady = false;
      settingsOpener = undefined;
      announcement = null;
      serverGpc = false;
      held = undefined;
      mapRefusals = 0;
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
      settingsLoading = !windowReady;
      refresh();
    },
    settingsReady: () => {
      windowReady = true;
      if (!settingsLoading) return;
      settingsLoading = false;
      refresh();
    },
    closeSettings: () => {
      settingsOpen = false;
      settingsLoading = false;
      refresh();
      if (settingsOpener?.isConnected === true) settingsOpener.focus();
    },
    resendPending: async () => {
      // A pending cookie ends in _p, so a visitor with none loads nothing here.
      if (read()?.endsWith('_p') !== true) return;
      await (await loadSave()).resendChoice(host);
    },
    clearData: async () => {
      try {
        await (await (options.loadService ?? loadConsentService)()).clear();
      } catch (error) {
        return isRateLimited(error) ? 'rate-limited' : 'failed';
      }
      // The server answered 2xx and set the reset cookie, so the browser may now forget; the consent cookie is not touched.
      forgetBrowserData();
      held = undefined;
      memory = freshMemory();
      announcement = null;
      refresh();
      return 'cleared';
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
  settingsReady: consentStore.settingsReady,
  resendPending: consentStore.resendPending,
  clearData: consentStore.clearData,
};

export function useConsent(): ConsentState & ConsentActions {
  'use no memo';
  const state = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getSnapshot);
  return { ...state, ...ACTIONS };
}
