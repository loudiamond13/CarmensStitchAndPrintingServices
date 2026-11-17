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

type Day = readonly [year: number, month: number, day: number];

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LIFETIME_MONTHS = 12;

function readDay(iso: string): Day | null {
  const match = DAY_PATTERN.exec(iso);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

// Month arithmetic that clamps the day (29 Feb plus 12 months is 28 Feb). No Date object, so no time zone is involved.
function addMonths([year, month, day]: Day, months: number): Day {
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return [newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth))];
}

function isBefore(a: Day, b: Day): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}

/**
 * True while the saved choice counts: the current policy version (D-22), a decision day that is not after today (D-43:
 * a cookie dated in the future is no choice, so it cannot stretch its own life) and less than 12 months old (ANL-07).
 * `today` is the Asia/Manila business day as YYYY-MM-DD, the day the server stamps through IBusinessCalendar, so a
 * cookie the server set today is current. No clock is read here. An unreadable day gives false.
 */
export function isCurrentChoice(cookie: ConsentCookie, options: { currentVersion: string; today: string }): boolean {
  if (cookie.policyVersion !== options.currentVersion) return false;
  const decided = readDay(cookie.decidedOn);
  const today = readDay(options.today);
  if (decided === null || today === null) return false;
  if (isBefore(today, decided)) return false;
  return isBefore(today, addMonths(decided, LIFETIME_MONTHS));
}

/**
 * True when the bar must ask: no cookie, a map-only save (D-18), or a choice that is not current (see isCurrentChoice:
 * new policy version, future decision day, 12 months old). Never true when the browser sends GPC (D-20).
 */
export function needsChoice(
  cookie: ConsentCookie | null,
  options: { currentVersion: string; today: string; gpc: boolean },
): boolean {
  if (options.gpc) return false;
  if (cookie === null) return true;
  if (cookie.stats === null) return true;
  return !isCurrentChoice(cookie, options);
}
