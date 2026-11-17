// The saved cookie choice (ANL-07). Plain functions only: this file ships in the public first download.

export const CONSENT_COOKIE_NAME = '__Host-csps_consent';

export interface ConsentCookie {
  consentId: string;
  policyVersion: string;
  /** true or false when chosen, null when not chosen yet (map-only save, D-18). */
  stats: boolean | null;
  map: boolean;
  /** The day of the choice as YYYY-MM-DD. */
  decidedOn: string;
  pending: boolean;
}

export function parseConsentCookie(value: string | undefined): ConsentCookie | null {
  void value;
  return null;
}

export function formatConsentCookie(cookie: ConsentCookie): string {
  void cookie;
  return '';
}
