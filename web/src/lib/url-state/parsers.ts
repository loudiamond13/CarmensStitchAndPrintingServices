// Allow-list parsers for list state in the URL (WEB-10, CWE-20). Anything a parser rejects falls back to the default,
// and createListParams removes it from the URL with one replace. The server re-validates every value (SEC-03).
import { createParser, parseAsStringLiteral } from 'nuqs';

/** Plain base-10 digits with no sign, no leading zero, no spaces, no exponent and no fraction. */
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function parsePositiveInteger(value: string): number | null {
  if (!POSITIVE_INTEGER.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

/** The page number: a plain integer of at least 1; anything else ('0', '2.5', '1e3', ' 2', '0x10') is page 1. */
export const parseAsPage = createParser<number>({
  parse: parsePositiveInteger,
  serialize: (page) => String(page),
}).withDefault(1);

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}

/** The page sizes a list offers; anything else ('9999', '20.0') is 20. The server still caps it at 100 (SEC-03). */
export const pageSizeParser = createParser<PageSize>({
  parse: (value) => {
    const size = parsePositiveInteger(value);
    return size !== null && isPageSize(size) ? size : null;
  },
  serialize: (size) => String(size),
}).withDefault(20);

/** An allow-listed string value (status, sort, tab, view) with its default. */
export function literalParser<const T extends string>(values: readonly T[], defaultValue: NoInfer<T>) {
  return parseAsStringLiteral(values).withDefault(defaultValue);
}

/**
 * The longest search, in UTF-16 code units: the same unit as the server's string length and the input's maxLength.
 * The server rejects longer text (SEC-03), because search text travels in URLs.
 */
export const SEARCH_MAX_LENGTH = 100;

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Trims the text, treats blank text as no search (null) and cuts it to SEARCH_MAX_LENGTH code units. The cut never
 * leaves a lone high surrogate, so an emoji at the limit is dropped whole, and the result is trimmed again so that
 * normalizing it a second time changes nothing.
 */
export function normalizeSearch(value: string): string | null {
  let text = value.trim();
  if (text.length > SEARCH_MAX_LENGTH) {
    text = text.slice(0, SEARCH_MAX_LENGTH);
    if (isHighSurrogate(text.charCodeAt(SEARCH_MAX_LENGTH - 1))) {
      text = text.slice(0, SEARCH_MAX_LENGTH - 1);
    }
    text = text.trimEnd();
  }
  return text === '' ? null : text;
}

/**
 * Free-text search (`q`). The owner allowed search in the URL; it is the only place personal data may appear in a URL
 * (WEB-10 privacy rules, CWE-598).
 */
export const parseAsSearch = createParser<string>({
  parse: normalizeSearch,
  serialize: (text) => text,
});

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function readCalendarDate(value: string): CalendarDate | null {
  const match = PLAIN_DATE.exec(value);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function formatCalendarDate(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Calendar arithmetic on the plain date (no zone is involved, so no day can shift). */
function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/**
 * A business date filter: a plain, calendar-valid `YYYY-MM-DD` string in business time (Asia/Manila) that stays a
 * string. Never parseAsIsoDate, which round-trips through UTC and shifts the day.
 */
export const parseAsBusinessDate = createParser<string>({
  parse: (value) => (readCalendarDate(value) === null ? null : value),
  serialize: (date) => date,
});

/** Preset date ranges, stored in the URL by name and resolved against the business today on every visit. */
export const RANGE_PRESETS = ['today', 'last-7-days', 'last-30-days', 'this-month', 'last-month', 'this-year'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** A preset-range parser that accepts only the names a list offers. */
export function parseAsRangePreset<const N extends RangePreset>(names: readonly N[]) {
  return parseAsStringLiteral(names);
}

export interface DateRange {
  /** First business date in the range, inclusive. */
  from: string;
  /** Last business date in the range, inclusive. */
  to: string;
}

/**
 * Resolves a preset against the business today (`YYYY-MM-DD`, from businessToday). Pure: the caller injects today, so
 * no default is ever computed from `new Date()`.
 */
export function resolveRangePreset(name: RangePreset, businessTodayIso: string): DateRange {
  const today = readCalendarDate(businessTodayIso);
  if (today === null) {
    throw new RangeError('The business today must be a calendar date (YYYY-MM-DD).');
  }
  const to = formatCalendarDate(today);
  switch (name) {
    case 'today':
      return { from: to, to };
    case 'last-7-days':
      return { from: formatCalendarDate(addDays(today, -6)), to };
    case 'last-30-days':
      return { from: formatCalendarDate(addDays(today, -29)), to };
    case 'this-month':
      return { from: formatCalendarDate({ ...today, day: 1 }), to };
    case 'last-month': {
      const lastDay = addDays({ ...today, day: 1 }, -1);
      return { from: formatCalendarDate({ ...lastDay, day: 1 }), to: formatCalendarDate(lastDay) };
    }
    case 'this-year':
      return { from: formatCalendarDate({ year: today.year, month: 1, day: 1 }), to };
  }
}

/** The business zone default (SiteSettings holds the real value; Manager-editable later). */
const BUSINESS_ZONE = 'Asia/Manila';

/**
 * The business calendar date (`YYYY-MM-DD`) at the injected instant. The caller passes `now` (from the clock it owns)
 * so tests and presets never depend on the machine's zone or a module-level `new Date()`.
 */
export function businessToday(now: Date, zone = BUSINESS_ZONE): string {
  // en-CA formats a numeric date as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  );
}
