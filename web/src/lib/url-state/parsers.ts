// Allow-list parsers for list state in the URL (WEB-10, CWE-20). Anything a parser rejects falls back to the default,
// and createListParams removes it from the URL with one replace. The server re-validates every value (SEC-03).
import { createParser, parseAsNumberLiteral, parseAsString, parseAsStringLiteral } from 'nuqs';

/** The page number: an integer of at least 1; anything else is page 1. */
export const parseAsPage = createParser<number>({
  parse: (value) => {
    const page = Number.parseInt(value, 10);
    return page >= 1 ? page : null;
  },
  serialize: (page) => String(page),
}).withDefault(1);

/** The page sizes a list offers; anything else is 20 (the server still caps it at 100, SEC-03). */
export const pageSizeParser = parseAsNumberLiteral([10, 20, 50, 100]).withDefault(20);

/** An allow-listed string value (status, sort, tab, view) with its default. */
export function literalParser<const T extends string>(values: readonly T[], defaultValue: NoInfer<T>) {
  return parseAsStringLiteral(values).withDefault(defaultValue);
}

// RED placeholders (02-08 Task 2): no trimming, no cap, no calendar check, no zone; replaced in GREEN.
export const SEARCH_MAX_LENGTH = 100;
export function normalizeSearch(value: string): string | null {
  return value;
}
export const parseAsSearch = parseAsString;
export const parseAsBusinessDate = parseAsString;
export const RANGE_PRESETS = ['today', 'last-7-days', 'last-30-days', 'this-month', 'last-month', 'this-year'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export function parseAsRangePreset<const N extends RangePreset>(names: readonly N[]) {
  return parseAsStringLiteral(names);
}
export function resolveRangePreset(_name: RangePreset, businessTodayIso: string): { from: string; to: string } {
  return { from: businessTodayIso, to: businessTodayIso };
}
export function businessToday(now: Date, zone = 'Asia/Manila'): string {
  return zone === '' ? '' : now.toISOString().slice(0, 10);
}
