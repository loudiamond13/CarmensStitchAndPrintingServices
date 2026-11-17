// Consent fixtures for component and store tests (plan 12-09): a cookie jar held in memory (jsdom will not keep a
// `__Host-` cookie on its http test URL), the one shared consent store reset to a chosen state, and an MSW probe for
// POST /api/v1/analytics/consent. Every value is made up.
import { http, HttpResponse } from 'msw';
import { formatConsentCookie, type ConsentCookie } from '@/modules/public/consentCookie';
import { manilaBusinessDay } from '@/modules/public/consentRules';
import { resetConsentStore } from '@/modules/public/hooks/useConsent';
import { COOKIE_POLICY_VERSION } from '@/modules/public/consentPolicy';
import type { ConsentDecision } from '@/modules/public/services/consentService';
import { server } from '@/test/msw';

export const FAKE_CONSENT_ID = '0123456789abcdef0123456789abcdef';

/** A current Reject All cookie dated today (Manila), with any part overridden. */
export function consentCookie(overrides: Partial<ConsentCookie> = {}): ConsentCookie {
  return {
    consentId: FAKE_CONSENT_ID,
    policyVersion: COOKIE_POLICY_VERSION,
    stats: false,
    map: false,
    decidedOn: manilaBusinessDay(new Date()),
    pending: false,
    ...overrides,
  };
}

export interface MemoryJar {
  /** The consent cookie value now, or undefined. */
  value: string | undefined;
  /** Every value written, in order (null is a removal). */
  readonly writes: (string | null)[];
}

export interface SetConsentOptions {
  /** The cookie in the jar: a cookie, its raw text, or null for none. */
  cookie?: ConsentCookie | string | null;
  gpc?: boolean;
  today?: () => string;
}

/** Resets the shared consent store over a fresh in-memory jar. The default is a decided Reject All, so no bar shows. */
export function setConsent({ cookie = consentCookie(), gpc = false, today }: SetConsentOptions = {}): MemoryJar {
  const jar: MemoryJar = {
    value: cookie === null ? undefined : typeof cookie === 'string' ? cookie : formatConsentCookie(cookie),
    writes: [],
  };
  resetConsentStore({
    readCookie: () => jar.value,
    writeCookie: (value) => {
      jar.writes.push(value);
      jar.value = value ?? undefined;
    },
    gpc,
    ...(today === undefined ? {} : { today }),
  });
  return jar;
}

/**
 * Waits until the shared store has loaded the cookie rules (it loads them when a cookie exists), so the first test of a
 * file sees the same state as the last. A store made with createConsentStore starts without them on purpose.
 */
export async function consentRulesLoaded(): Promise<void> {
  await import('@/modules/public/consentRules');
  await Promise.resolve();
}

export const demoDecision: ConsentDecision = {
  consentId: FAKE_CONSENT_ID,
  policyVersion: COOKIE_POLICY_VERSION,
  stats: true,
  map: true,
  gpc: false,
  decidedOn: '2026-11-17',
};

export interface ConsentProbe {
  readonly requests: { body: unknown; csrf: string | null }[];
}

/** Answers POST /api/v1/analytics/consent and records each body and its anti-CSRF header. */
export function consentProbe(answer: () => Response = () => HttpResponse.json(demoDecision)): ConsentProbe {
  const probe: ConsentProbe = { requests: [] };
  server.use(
    http.post('*/api/v1/analytics/consent', async ({ request }) => {
      probe.requests.push({ body: await request.json(), csrf: request.headers.get('X-CSPS-CSRF') });
      return answer();
    }),
  );
  return probe;
}
