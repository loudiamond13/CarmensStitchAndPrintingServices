// Allow-list parsers for list state in the URL (WEB-10, CWE-20). Anything a parser rejects falls back to the default,
// and createListParams removes it from the URL with one replace. The server re-validates every value (SEC-03).
import { createParser, parseAsNumberLiteral, parseAsStringLiteral } from 'nuqs';

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
