// The one way a list keeps its view in the URL (WEB-10): createListParams(parsers) returns a typed hook built on
// nuqs useQueryStates. Lists read and write their state only through that hook and never copy it into useState or
// form state.
import { parseAsString, useQueryStates, type Nullable, type ParserMap, type UrlKeys, type Values } from 'nuqs';
import { useEffect } from 'react';

/**
 * What normalization needs from a parser. Every nuqs single-value parser builder (createParser, parseAsStringLiteral,
 * parseAsNumberLiteral, `.withDefault(...)`) has these members. Method syntax keeps the value types bivariant, so a
 * `SingleParserBuilder<number>` fits.
 */
export interface ListParser {
  parse(value: string): unknown;
  serialize(value: unknown): string;
  eq(a: unknown, b: unknown): boolean;
  readonly defaultValue?: unknown;
}

export type ListParserMap = ParserMap & Record<string, ListParser>;

export interface ListParamsOptions<P extends ListParserMap> {
  /** URL key per state key. `pageSize` is `size` and `search` is `q` unless overridden. */
  urlKeys?: UrlKeys<P>;
}

type Patch<P extends ListParserMap> = Partial<Nullable<Values<P>>>;
type RawParserMap = Record<string, typeof parseAsString>;

const DEFAULT_URL_KEYS: Readonly<Record<string, string>> = { pageSize: 'size', search: 'q' };

function parseOrNull(parser: ListParser, query: string): unknown {
  try {
    return parser.parse(query) ?? null;
  } catch {
    return null;
  }
}

/**
 * The URL rewrite that makes every present key canonical, or null when the URL is already canonical. A key whose raw
 * value is invalid, or equals its default, is removed; a valid value that serializes differently is rewritten.
 * Non-string raw values are skipped: they are values nuqs echoed from this hook's own writes, which are canonical.
 */
function normalizationPatch(
  parsers: Readonly<Record<string, ListParser>>,
  raw: Readonly<Record<string, unknown>>,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  let changed = false;
  for (const [key, parser] of Object.entries(parsers)) {
    const query = raw[key];
    if (typeof query !== 'string') continue;
    const value = parseOrNull(parser, query);
    const isDefault = value !== null && parser.defaultValue !== undefined && parser.eq(value, parser.defaultValue);
    const canonical = value === null || isDefault ? null : parser.serialize(value);
    if (canonical === query) continue;
    patch[key] = canonical === null ? null : value;
    changed = true;
  }
  return changed ? patch : null;
}

export function createListParams<P extends ListParserMap>(parsers: P, options: ListParamsOptions<P> = {}) {
  const urlKeys = { ...DEFAULT_URL_KEYS, ...options.urlKeys };
  const hookOptions = { urlKeys: urlKeys as UrlKeys<P> };
  const rawParsers: RawParserMap = Object.fromEntries(Object.keys(parsers).map((key) => [key, parseAsString]));
  const rawOptions = { urlKeys: urlKeys as UrlKeys<RawParserMap> };

  return function useListParams() {
    const [values, setParams] = useQueryStates(parsers, hookOptions);
    // The same keys as raw strings, to tell "absent" from "present but invalid" (both parse to the default).
    const [raw] = useQueryStates(rawParsers, rawOptions);

    // Normalize once: an invalid, default or non-canonical value is rewritten with a single replace. After it, the
    // URL is canonical, so the next run finds nothing to change (idempotent).
    useEffect(() => {
      const patch = normalizationPatch(parsers, raw);
      if (patch !== null) {
        void setParams(patch as Patch<P>, { history: 'replace' });
      }
    }, [raw, setParams]);

    return [values] as const;
  };
}
