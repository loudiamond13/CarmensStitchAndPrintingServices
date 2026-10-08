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

/** The list's setters. Every one but setPage replaces the history entry and resets the page in the same update. */
export interface ListParamsSetters<P extends ListParserMap> {
  /** Adds a history entry (push). Anything but an integer of at least 1 means page 1. */
  setPage: (page: number) => void;
  setPageSize: (size: Arg<P, 'pageSize'>) => void;
  setFilter: <K extends FilterKey<P>>(key: K, value: Values<P>[K] | null) => void;
  /** Trims and caps the text; writes the URL after 300 ms of quiet, or at once with `immediate` (Enter). */
  setSearch: (value: string, options?: { immediate?: boolean }) => void;
  setSort: (value: Arg<P, 'sort'>) => void;
  setTab: (value: Arg<P, 'tab'>) => void;
  setView: (value: Arg<P, 'view'>) => void;
  /** Replaces a page past `lastPage` with `lastPage` (no-op when there is no page, `lastPage` < 1). */
  clampPage: (lastPage: number) => void;
  /** Clears every key of this list in one replace. */
  reset: () => void;
}

type Patch<P extends ListParserMap> = Partial<Nullable<Values<P>>>;
type RawParserMap = Record<string, typeof parseAsString>;
type Arg<P extends ListParserMap, K extends string> = K extends keyof P ? Values<P>[K] | null : never;
type FilterKey<P extends ListParserMap> = Exclude<keyof P & string, 'page'>;

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

    // RED placeholder (02-08 Task 2): inert setters; replaced in GREEN.
    const noop = (): void => undefined;
    const setters: ListParamsSetters<P> = {
      setPage: noop,
      setPageSize: noop,
      setFilter: noop,
      setSearch: noop,
      setSort: noop,
      setTab: noop,
      setView: noop,
      clampPage: noop,
      reset: noop,
    };
    return [values, setters] as const;
  };
}
