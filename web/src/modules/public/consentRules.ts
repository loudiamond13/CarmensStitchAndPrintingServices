// What a saved consent cookie means today (ANL-07, D-20, D-22, D-43): the rules and the business day. The store loads this
// as its own chunk when a cookie exists or a choice is made, and never in the first download of a first visit (PERF-01).
import { isCurrentChoice, needsChoice, parseConsentCookie, type ConsentCookie } from './consentCookie';
import { COOKIE_POLICY_VERSION } from './consentPolicy';

const BUSINESS_ZONE = 'Asia/Manila';

/** The business day (Asia/Manila) of an instant as YYYY-MM-DD; the same day the server stamps on the cookie (D-43). */
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

export interface ConsentRuleInputs {
  gpc: boolean;
  /** Defaults to the Cookie Policy version. */
  currentVersion?: string | undefined;
  /** Defaults to the Asia/Manila business day now. */
  today?: (() => string) | undefined;
}

export function policyVersion(inputs: Pick<ConsentRuleInputs, 'currentVersion'>): string {
  return inputs.currentVersion ?? COOKIE_POLICY_VERSION;
}

export function businessToday(inputs: Pick<ConsentRuleInputs, 'today'>): string {
  return (inputs.today ?? (() => manilaBusinessDay(new Date())))();
}

export interface DerivedConsent {
  cookie: ConsentCookie | null;
  /** The cookie counts today: this policy version, not dated in the future, under 12 months old. */
  current: boolean;
  needsChoice: boolean;
  statsAllowed: boolean;
  mapAllowed: boolean;
}

/** The saved cookie as read and what it allows now: the version, the day and the 12-month rules live in isCurrentChoice. */
export function deriveConsent(raw: string | undefined, inputs: ConsentRuleInputs): DerivedConsent {
  const cookie = parseConsentCookie(raw);
  const checks = { currentVersion: policyVersion(inputs), today: businessToday(inputs) };
  const current = cookie !== null && isCurrentChoice(cookie, checks);
  return {
    cookie,
    current,
    needsChoice: needsChoice(cookie, { ...checks, gpc: inputs.gpc }),
    statsAllowed: !inputs.gpc && current && cookie.stats === true,
    mapAllowed: current && cookie.map,
  };
}
