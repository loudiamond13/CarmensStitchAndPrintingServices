// RED placeholder (02-08 Task 1): plain nuqs parsers with no allow-list; replaced in GREEN.
import { parseAsInteger, parseAsStringLiteral } from 'nuqs';

export const parseAsPage = parseAsInteger.withDefault(1);
export const pageSizeParser = parseAsInteger.withDefault(20);

export function literalParser<const T extends string>(values: readonly T[], defaultValue: NoInfer<T>) {
  return parseAsStringLiteral(values).withDefault(defaultValue);
}
