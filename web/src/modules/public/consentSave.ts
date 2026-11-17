// The save path of a consent choice (ANL-01, ANL-07, D-17): writes the provisional cookie, applies the choice in this
// browser at once, then sends it to the server. It loads only when a choice is made (the cookie bar and the settings
// window import it, and the store loads it on demand), so the public first download holds the read side only (PERF-01).
// This file never writes the confirmed cookie: the server sets it (plan 12-08).
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

/** What the store lends the save path: its settings and the few things a save may change. */
export interface SaveHost {
  options: () => ConsentStoreOptions;
  announce: (line: string) => void;
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

async function send(host: SaveHost, body: ConsentRecordBody): Promise<void> {
  try {
    const service = await (host.options().loadService ?? loadConsentService)();
    await service.record(body);
    host.refresh();
  } catch {
    // The choice already applies in this browser; a failed send is never shown to the visitor.
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

/** The map part only (D-18): the stats part stays as it was while it still counts, else unchosen. */
export function mapOnlyChoice(host: SaveHost): ConsentChoice {
  const options = host.options();
  const cookie = parseConsentCookie(options.readCookie());
  const checks = { currentVersion: policyVersion(options), today: businessToday(options) };
  const current = cookie !== null && isCurrentChoice(cookie, checks);
  return { stats: current ? cookie.stats : null, map: true };
}
