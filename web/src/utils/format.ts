// Date and money-entry formatting for ORD-09. Phase 1 locale decision: dates read "Oct 6, 2026" in the business
// zone (BUSINESS_ZONE below; SiteSettings holds the real value and makes it Manager-editable later, so the zone is
// a parameter with a default). Money display stays formatPeso in @/utils/csps (U+2212 negatives, D-09 centavos).
// Nothing here reads the machine's zone: instants format with an explicit time zone, calendar dates in UTC.

/** The default business zone (Phase 1 decision; SiteSettings overrides it later). */
export const BUSINESS_ZONE = 'Asia/Manila';

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
 * in the business zone. Any other text gives null (render EmptyValue).
 */
export function formatBusinessDate(utcIso: string, zone: string = BUSINESS_ZONE): string | null {
  if (calendarParts(INSTANT.exec(utcIso)) === null) return null;
  return formatterFor(zone).format(new Date(utcIso));
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const NON_BREAKING_SPACES = /[\u202F\u00A0]/g;

/** One cached en-US "Oct 12, 2026, 3:42 PM" formatter per zone. */
function dateTimeFormatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(zone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    dateTimeFormatters.set(zone, formatter);
  }
  return formatter;
}

/**
 * "Oct 12, 2026, 3:42 PM": a UTC instant from the API as seen in the business zone. Newer ICU puts a narrow no-break
 * space before AM/PM; it becomes a plain space so the text matches what staff read and type. Any other input gives
 * null (render EmptyValue).
 */
export function formatBusinessDateTime(utcIso: string, zone: string = BUSINESS_ZONE): string | null {
  if (calendarParts(INSTANT.exec(utcIso)) === null) return null;
  return dateTimeFormatterFor(zone).format(new Date(utcIso)).replace(NON_BREAKING_SPACES, ' ');
}

/** "Oct 6, 2026" for a plain YYYY-MM-DD business date, with no zone shift. Any other text gives null (render EmptyValue). */
export function formatCalendarDate(ymd: string): string | null {
  const parts = calendarParts(CALENDAR_DATE.exec(ymd));
  if (parts === null) return null;
  const [year, month, day] = parts;
  return formatterFor('UTC').format(new Date(Date.UTC(year, month - 1, day)));
}

// Money entry (ORD-09, UI-SPEC MoneyInput row). An amount stays text while it is typed and becomes whole centavos
// only here, by integer arithmetic on its digit strings, never through a binary float (D-09). The server re-validates
// every amount (T-02-21); these rules only keep the field honest.

/** MoneyInput text: up to 9 integer digits and 2 decimals, ASCII digits only, never a sign or grouping. No flags. */
export const MONEY_TEXT = /^\d{0,9}(\.\d{0,2})?$/;

/** 999999999.99, the largest amount MONEY_TEXT can hold. */
const MAX_CENTAVOS = 99_999_999_999;

/** The integer and fraction digits of money text, or null when the text breaks MONEY_TEXT. */
function moneyDigits(text: string): { readonly whole: string; readonly fraction: string } | null {
  if (!MONEY_TEXT.test(text)) return null;
  const dot = text.indexOf('.');
  return dot === -1 ? { whole: text, fraction: '' } : { whole: text.slice(0, dot), fraction: text.slice(dot + 1) };
}

/** True when the text is allowed in a money field, including the partial states "", "." and "5." while typing. */
export function isMoneyText(text: string): boolean {
  return MONEY_TEXT.test(text);
}

/**
 * Thousands grouping: 1 to 3 digits, then groups of exactly 3 after ONE kind of separator (a comma, a space, a
 * no-break space, a narrow no-break space or a thin space), then an optional fraction.
 */
const GROUPED_MONEY = /^\d{1,3}([, \u00A0\u202F\u2009])\d{3}(?:\1\d{3})*(?:\.\d*)?$/;
const GROUP_SEPARATORS = /[, \u00A0\u202F\u2009]/g;

/**
 * A pasted amount with its surrounding whitespace and thousands grouping removed (" 12,450.00 " → "12450.00",
 * "1 250.50" → "1250.50"). A comma or space counts only between groups of three digits, so "1,50", "12 50" or "1,2,3"
 * give "" instead of a different amount (₱150.00, LIB-WR-06). Anything that still breaks MONEY_TEXT, including a minus
 * sign, a third decimal or a peso sign, gives "".
 */
export function normalizePastedMoney(text: string): string {
  const trimmed = text.trim();
  const candidate = GROUPED_MONEY.test(trimmed) ? trimmed.replace(GROUP_SEPARATORS, '') : trimmed;
  return MONEY_TEXT.test(candidate) ? candidate : '';
}

/**
 * The blur value of a money field: two decimals ("5000" → "5000.00", ".5" → "0.50"). "" and "." stay empty, and text
 * that is not money text comes back unchanged so the field can show its error.
 */
export function padMoneyOnBlur(text: string): string {
  const digits = moneyDigits(text);
  if (digits === null) return text;
  if (digits.whole === '' && digits.fraction === '') return '';
  return `${digits.whole === '' ? '0' : digits.whole}.${digits.fraction.padEnd(2, '0')}`;
}

/**
 * Whole centavos of money text ("0.07" → 7, "999999999.99" → 99999999999). At most 11 digits, so the result is an
 * exact safe integer. Throws a TypeError for "" or "." ("empty amount") and for text that breaks MONEY_TEXT
 * ("not an amount"): callers validate first.
 */
export function moneyTextToCentavos(text: string): number {
  const digits = moneyDigits(text);
  if (digits === null) throw new TypeError('not an amount');
  if (digits.whole === '' && digits.fraction === '') throw new TypeError('empty amount');
  return Number(digits.whole) * 100 + Number(digits.fraction.padEnd(2, '0'));
}

/**
 * Money text with two decimals for whole centavos (125050 → "1250.50"), the inverse of moneyTextToCentavos.
 * Throws a RangeError unless the amount is a whole number of centavos from 0 to 99999999999.
 */
export function centavosToMoneyText(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0 || centavos > MAX_CENTAVOS) {
    throw new RangeError('centavos must be a whole number from 0 to 99999999999');
  }
  const fraction = centavos % 100;
  return `${String((centavos - fraction) / 100)}.${String(fraction).padStart(2, '0')}`;
}
