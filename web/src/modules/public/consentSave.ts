// The save path of a consent choice (ANL-01, ANL-07, D-17, D-22): writes the provisional cookie, applies the choice in this
// browser at once, then sends it to the server. It loads only when a choice is made (the cookie bar and the settings
// window import it, and the store loads it on demand), so the public first download holds the read side only (PERF-01).
// This file never writes the confirmed cookie: the server sets it (plan 12-08).
//   - A send that fails keeps the choice: the provisional cookie stays and PublicLayout sends it again on the next page
//     view (resendChoice). The visitor sees no error.
//   - A 409 (the Cookie Policy changed since this page loaded) removes the provisional cookie, so the bar asks again.
import {
  CONSENT_COOKIE_NAME,
  formatConsentCookie,
  isCurrentChoice,
  parseConsentCookie,
  type ConsentCookie,
} from './consentCookie';
import { businessToday, policyVersion } from './consentRules';
import type { ConsentChoice, ConsentStoreOptions } from './hooks/useConsent';
import type { ConsentRecordBody, ConsentService, ConsentSource } from './services/consentService';

const LIFETIME_SECONDS = 365 * 24 * 60 * 60;
const POLICY_CHANGED = 'consent.policy-changed';

/** What the save path remembers between sends, per store. */
export interface SendMemory {
  inFlight: boolean;
  /** The cookie text found after the server last answered; a pending cookie that is still there is not sent again. */
  answeredValue: string | undefined;
  /** Where the last choice was made, for a resend after a reload. */
  lastSource: ConsentSource;
}

/** What the store lends the save path: its settings, its memory and the few things a save may change. */
export interface SaveHost {
  options: () => ConsentStoreOptions;
  memory: () => SendMemory;
  announce: (line: string | null) => void;
  /** The server saw Global Privacy Control (D-20): stats stay off and the bar stays away. */
  markGpc: () => void;
  refresh: () => void;
}

/** The `Set-Cookie` text for the provisional cookie, or for its removal (null): `__Host-` rules, 12 months. */
export function consentCookieText(value: string | null): string {
  const attributes = `Path=/; Secure; SameSite=Lax; Max-Age=${String(value === null ? 0 : LIFETIME_SECONDS)}`;
  return `${CONSENT_COOKIE_NAME}=${value ?? ''}; ${attributes}`;
}

/** The only `document.cookie` write on the public site before the server answers (ANL-01). */
export function writeBrowserCookie(value: string | null): void {
  document.cookie = consentCookieText(value);
}

function randomConsentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function loadConsentService(): Promise<ConsentService> {
  return import('./services/consentService').then((module) => module.consentService);
}

/** True for the server's 409 that says the policy version is old (D-22). Read by shape: no error class is imported here. */
function isPolicyConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const shape = error as { status?: unknown; code?: unknown };
  return shape.status === 409 && shape.code === POLICY_CHANGED;
}

async function send(host: SaveHost, body: ConsentRecordBody): Promise<void> {
  const memory = host.memory();
  memory.inFlight = true;
  try {
    const service = await (host.options().loadService ?? loadConsentService)();
    const answer = await service.record(body);
    memory.answeredValue = host.options().readCookie();
    if (answer.gpc) host.markGpc();
  } catch (error) {
    if (isPolicyConflict(error)) {
      const options = host.options();
      if (parseConsentCookie(options.readCookie())?.pending === true) (options.writeCookie ?? writeBrowserCookie)(null);
      host.announce(null);
    }
    // Any other failure: the choice already applies in this browser and is sent again on a later page view.
  } finally {
    memory.inFlight = false;
    host.refresh();
  }
}

export async function commitChoice(
  host: SaveHost,
  choice: ConsentChoice,
  source: ConsentSource,
  announce: string | null,
): Promise<void> {
  const options = host.options();
  const prior = parseConsentCookie(options.readCookie());
  const stats = options.gpc && choice.stats === true ? false : choice.stats;
  const decision: ConsentCookie = {
    consentId: prior?.consentId ?? (options.newConsentId ?? randomConsentId)(),
    policyVersion: policyVersion(options),
    stats,
    map: choice.map,
    decidedOn: businessToday(options),
    pending: true,
  };
  (options.writeCookie ?? writeBrowserCookie)(formatConsentCookie(decision));
  host.memory().lastSource = source;
  if (announce !== null) host.announce(announce);
  host.refresh();
  await send(host, {
    ...(prior === null ? {} : { consentId: prior.consentId }),
    policyVersion: decision.policyVersion,
    stats,
    map: choice.map,
    source,
  });
}

/** Sends a provisional choice once more, unless one is on its way or the server already answered for this cookie. */
export async function resendChoice(host: SaveHost): Promise<void> {
  const raw = host.options().readCookie();
  const cookie = parseConsentCookie(raw);
  const memory = host.memory();
  if (cookie?.pending !== true || memory.inFlight || raw === memory.answeredValue) return;
  await send(host, {
    consentId: cookie.consentId,
    policyVersion: cookie.policyVersion,
    stats: cookie.stats,
    map: cookie.map,
    source: memory.lastSource,
  });
}

/** The map part only (D-18): the stats part stays as it was while it still counts, else unchosen. */
export function mapOnlyChoice(host: SaveHost): ConsentChoice {
  const options = host.options();
  const cookie = parseConsentCookie(options.readCookie());
  const checks = { currentVersion: policyVersion(options), today: businessToday(options) };
  const current = cookie !== null && isCurrentChoice(cookie, checks);
  return { stats: current ? cookie.stats : null, map: true };
}
