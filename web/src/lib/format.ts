// Date and money-entry formatting for ORD-09. Phase 1 locale decision: dates read "Oct 6, 2026" in the business
// zone (BUSINESS_ZONE below; SiteSettings holds the real value and makes it Manager-editable later, so the zone is
// a parameter with a default). Money display stays formatPeso in @/lib/csps (U+2212 negatives, D-09 centavos).
// Nothing here reads the machine's zone: instants format with an explicit time zone, calendar dates in UTC.

/** The default business zone (Phase 1 decision; SiteSettings overrides it later). */
export const BUSINESS_ZONE = 'Asia/Manila';

const EMPTY = '—';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One cached en-US "Oct 6, 2026" formatter per zone. An unknown zone throws a RangeError (a settings bug). */
function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' });
    formatters.set(zone, formatter);
  }
  return formatter;
}

/** True when year-month-day names a real calendar day (no Feb 30, no month 13). */
function isCalendarDay(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

// An RFC 3339 instant with a zone designator. A string without one would be read in the machine's zone, and the
// browser rolls impossible parts over (Feb 30 → Mar 2, 24:00 → the next day), so both are refused.
const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reads the year, month and day captures of INSTANT or CALENDAR_DATE; null when the day does not exist. */
function calendarParts(match: RegExpExecArray | null): readonly [number, number, number] | null {
  if (match === null) return null;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  return isCalendarDay(year, month, day) ? [year, month, day] : null;
}

/**
 * "Oct 6, 2026": the calendar date of a UTC instant from the API (an ISO timestamp with "Z" or an offset), as seen
 * in the business zone. Any other text gives "—".
 */
export function formatBusinessDate(utcIso: string, zone: string = BUSINESS_ZONE): string {
  if (calendarParts(INSTANT.exec(utcIso)) === null) return EMPTY;
  return formatterFor(zone).format(new Date(utcIso));
}

/** "Oct 6, 2026" for a plain YYYY-MM-DD business date, with no zone shift. Any other text gives "—". */
export function formatCalendarDate(ymd: string): string {
  const parts = calendarParts(CALENDAR_DATE.exec(ymd));
  if (parts === null) return EMPTY;
  const [year, month, day] = parts;
  return formatterFor('UTC').format(new Date(Date.UTC(year, month - 1, day)));
}
