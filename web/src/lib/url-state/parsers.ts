// Allow-list parsers for list state in the URL (WEB-10, CWE-20). A value a parser rejects falls back to its default,
// and createListParams removes it from the URL with one replace. The server re-validates every value (SEC-03).
import { createParser, parseAsStringLiteral } from 'nuqs';

/** Plain base-10 digits with no sign, no leading zero, no spaces, no exponent and no fraction. */
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function parsePositiveInteger(value: string): number | null {
  if (!POSITIVE_INTEGER.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

/** The page number: a plain integer of at least 1; anything else ('0', '-3', '2.5', '1e3', ' 2') is page 1. */
export const pageParser = createParser<number>({
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
 * The longest search, in UTF-16 code units: the same unit as the input's maxLength and .NET string.Length. The server
 * rejects longer text (SEC-03), because search text travels in URLs.
 */
export const SEARCH_MAX_LENGTH = 100;

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Trims the text, treats blank text as no search (null) and cuts it to SEARCH_MAX_LENGTH code units. The cut never
 * leaves a lone high surrogate, so an emoji at the limit is dropped whole, and the result is trimmed again, so that
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
 * Free-text search (`q`). The owner allowed search in the URL; it is the only place personal data may appear in a
 * URL (WEB-10 privacy rules, CWE-598).
 */
export const searchParser = createParser<string>({
  parse: normalizeSearch,
  serialize: (text) => text,
});

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const THIRTY_DAY_MONTHS: readonly number[] = [4, 6, 9, 11];

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return THIRTY_DAY_MONTHS.includes(month) ? 30 : 31;
}

/** True when the text is a real calendar date written exactly as `YYYY-MM-DD` (year 0001 or later). */
export function isCalendarDate(value: string): boolean {
  const match = PLAIN_DATE.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * A business date filter: a plain, calendar-valid `YYYY-MM-DD` string in business time (Asia/Manila) that stays a
 * string. Never parseAsIsoDate, which round-trips through UTC and shifts the day.
 */
export const parseAsBusinessDate = createParser<string>({
  parse: (value) => (isCalendarDate(value) ? value : null),
  serialize: (date) => date,
});

/**
 * The page to show once the list's page count is known: a page past the last page becomes the last page, and an empty
 * result (0 pages) becomes page 1, where the list shows its EmptyState.
 */
export function clampPage(page: number, totalPages: number): number {
  const lastPage = Math.max(1, totalPages);
  return Math.max(1, Math.min(page, lastPage));
}
