// Dev-only (plan 12-29; never shipped, D-20): seeds the one shared consent store for a consent scenario or showcase demo.
// The consent cookie lives in memory and the consent service is a stand-in, so no choice or clear leaves the page, no cookie
// is written, and a demo clear puts this browser's storage back afterwards (the admin keeps its theme and list views).
import { formatConsentCookie } from '@/modules/public/consentCookie';
import { COOKIE_POLICY_VERSION } from '@/modules/public/consentPolicy';
import { resetConsentStore, type ConsentStoreOptions } from '@/modules/public/hooks/useConsent';
import type { ConsentDecision, ConsentService } from '@/modules/public/services/consentService';
import { serverError } from './serverError';

/** The Cookie Settings states the showcase shows. */
export type DemoConsentState = 'no-choice' | 'saved' | 'gpc' | 'cleared' | 'clear-failed';

/** The demo business day, so the saved line always reads "You chose on Nov 3, 2026". */
const DEMO_DAY = '2026-11-03';
const DEMO_CONSENT_ID = '0123456789abcdef0123456789abcdef';
const FAILED_TRACE_ID = '00-3f6c2b9a1e7d4c08b5a2f91d6e4c7a30-01';

function demoCookie(stats: boolean, map: boolean): string {
  return formatConsentCookie({
    consentId: DEMO_CONSENT_ID,
    policyVersion: COOKIE_POLICY_VERSION,
    stats,
    map,
    decidedOn: DEMO_DAY,
    pending: false,
  });
}

function decision(stats: boolean | null, map: boolean, gpc: boolean): ConsentDecision {
  return { consentId: DEMO_CONSENT_ID, decidedOn: DEMO_DAY, gpc, map, policyVersion: COOKIE_POLICY_VERSION, stats };
}

/** A copy of this browser's storage, and the function that puts it back. Blocked storage has nothing to keep. */
function keepStorage(): () => void {
  const kept: (readonly [Storage, string, string])[] = [];
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        const value = key === null ? null : store.getItem(key);
        if (key !== null && value !== null) kept.push([store, key, value]);
      }
    }
  } catch {
    return () => undefined;
  }
  return () => {
    for (const [store, key, value] of kept) store.setItem(key, value);
  };
}

/** The store's options from before the first demo, so leaving a demo can put the real cookie and the real GPC signal back. */
let browserOptions: ConsentStoreOptions | undefined;

/** Points the shared consent store at this browser again, when a demo leaves. */
export function restoreDemoConsent(): void {
  if (browserOptions === undefined) return;
  resetConsentStore(browserOptions);
  browserOptions = undefined;
}

/** Resets the shared consent store to the state, over an in-memory cookie and a stand-in service. */
export function seedDemoConsent(state: DemoConsentState): void {
  const gpc = state === 'gpc';
  let jar: string | undefined =
    state === 'no-choice' || state === 'gpc' ? undefined : demoCookie(true, state === 'cleared');
  const service: ConsentService = {
    record: (body) => Promise.resolve(decision(body.stats, body.map, gpc)),
    clear: () => {
      if (state === 'clear-failed') return Promise.reject(serverError(FAILED_TRACE_ID));
      // The store forgets this browser's storage right after this answer; the copy goes back on the next task.
      window.setTimeout(keepStorage(), 0);
      jar = demoCookie(false, false);
      return Promise.resolve(decision(false, false, gpc));
    },
  };
  const previous = resetConsentStore({
    readCookie: () => jar,
    writeCookie: (value) => {
      jar = value ?? undefined;
    },
    gpc,
    today: () => DEMO_DAY,
    loadService: () => Promise.resolve(service),
    newConsentId: () => DEMO_CONSENT_ID,
  });
  browserOptions ??= previous;
}
