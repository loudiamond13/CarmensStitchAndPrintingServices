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

const MAX_LENGTH = 100;

// Strict on purpose: the cookie is writable by any script, so anything off-format is "no choice".
const PATTERN = /^1_([0-9a-f]{32})_(\d+\.\d+)_([01-])_([01])_(\d{4})(\d{2})(\d{2})(_p)?$/;

function isRealDay(year: number, month: number, day: number): boolean {
  if (year < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseConsentCookie(value: string | undefined): ConsentCookie | null {
  if (!value || value.length > MAX_LENGTH) return null;
  const match = PATTERN.exec(value);
  if (!match) return null;
  const [, consentId = '', policyVersion = '', stats = '', map = '', year = '', month = '', day = '', pending = ''] =
    match;
  if (!isRealDay(Number(year), Number(month), Number(day))) return null;
  return {
    consentId,
    policyVersion,
    stats: stats === '-' ? null : stats === '1',
    map: map === '1',
    decidedOn: `${year}-${month}-${day}`,
    pending: pending !== '',
  };
}

export function formatConsentCookie(cookie: ConsentCookie): string {
  const stats = cookie.stats === null ? '-' : cookie.stats ? '1' : '0';
  const map = cookie.map ? '1' : '0';
  const suffix = cookie.pending ? '_p' : '';
  return `1_${cookie.consentId}_${cookie.policyVersion}_${stats}_${map}_${cookie.decidedOn.replaceAll('-', '')}${suffix}`;
}

/** The consent cookie value from a `document.cookie` string, or undefined when there is none. */
export function readConsentCookie(documentCookie: string): string | undefined {
  for (const pair of documentCookie.split(';')) {
    const text = pair.trimStart();
    const equals = text.indexOf('=');
    if (equals > 0 && text.slice(0, equals) === CONSENT_COOKIE_NAME) return text.slice(equals + 1);
  }
  return undefined;
}
