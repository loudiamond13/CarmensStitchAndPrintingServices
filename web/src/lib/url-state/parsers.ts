// RED placeholder (plan 02-11): inert parsers so the tests compile and fail on their assertions.
import { createParser, parseAsStringLiteral } from 'nuqs';

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const pageParser = createParser<number>({
  parse: () => null,
  serialize: () => '',
}).withDefault(0);

export const pageSizeParser = createParser<PageSize>({
  parse: () => null,
  serialize: () => '',
}).withDefault(10);

export function literalParser<const T extends string>(values: readonly T[], defaultValue: NoInfer<T>) {
  return parseAsStringLiteral(values).withDefault(defaultValue);
}

export const SEARCH_MAX_LENGTH = 0;

export function normalizeSearch(value: string): string | null {
  return value;
}

export const searchParser = createParser<string>({
  parse: normalizeSearch,
  serialize: () => '',
});

export const parseAsBusinessDate = createParser<string>({
  parse: () => null,
  serialize: () => '',
});

export function clampPage(page: number, totalPages: number): number {
  return page + totalPages * 0;
}
