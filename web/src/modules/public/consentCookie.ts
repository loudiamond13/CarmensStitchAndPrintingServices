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
  if (!value) return null;
  const parts = value.split('_');
  if (parts.length !== 6 || parts[0] !== '1') return null;
  const [, consentId = '', policyVersion = '', stats = '', map = '', day = ''] = parts;
  return {
    consentId,
    policyVersion,
    stats: stats === '1',
    map: map === '1',
    decidedOn: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
    pending: false,
  };
}

export function formatConsentCookie(cookie: ConsentCookie): string {
  const stats = cookie.stats === true ? '1' : '0';
  const map = cookie.map ? '1' : '0';
  return `1_${cookie.consentId}_${cookie.policyVersion}_${stats}_${map}_${cookie.decidedOn.replaceAll('-', '')}`;
}
