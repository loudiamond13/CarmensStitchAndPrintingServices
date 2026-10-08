// The one way a list keeps its view in the URL (WEB-10): createListParams(parsers) returns a typed hook built on
// nuqs useQueryStates. Lists read and write their state only through that hook and never copy it into useState or
// form state.
import {
  debounce,
  parseAsString,
  useQueryStates,
  type Nullable,
  type Options,
  type ParserMap,
  type UrlKeys,
  type Values,
} from 'nuqs';
import { useEffect } from 'react';
import { normalizeSearch } from './parsers';

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

/** Quiet time before a search is written to the URL (WEB-08, WEB-10). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * URL parameter names that would hold personal data or a secret (WEB-10 privacy rules, CWE-598). Personal data may
 * appear only inside the free-text `q`; tokens, codes and secrets never appear in a URL. Compared lower-case with
 * everything but letters removed, so `Email`, `customer_name` and `access-token` are caught too.
 */
const FORBIDDEN_URL_KEYS: ReadonlySet<string> = new Set([
  'email',
  'phone',
  'mobile',
  'name',
  'firstname',
  'lastname',
  'fullname',
  'customername',
  'address',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
  'otp',
  'code',
]);

function assertAllowedUrlKey(urlKey: string): void {
  if (FORBIDDEN_URL_KEYS.has(urlKey.toLowerCase().replace(/[^a-z]/g, ''))) {
    throw new TypeError(
      `"${urlKey}" must not be a URL parameter: personal data goes only in the free-text search and secrets never go in a URL (WEB-10).`,
    );
  }
}

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
  const urlKeys: Record<string, string | undefined> = { ...DEFAULT_URL_KEYS, ...options.urlKeys };
  for (const key of Object.keys(parsers)) {
    assertAllowedUrlKey(urlKeys[key] ?? key);
  }
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

    const write = (patch: Record<string, unknown>, writeOptions: Options): void => {
      void setParams(patch as Patch<P>, writeOptions);
    };
    // Every change but a page change replaces the history entry and resets the page in the same single URL update.
    const replaceAndResetPage = (patch: Record<string, unknown>, extra: Options = {}): void => {
      write({ ...patch, page: null }, { history: 'replace', ...extra });
    };

    const setters: ListParamsSetters<P> = {
      setPage: (page) => {
        write({ page: Number.isSafeInteger(page) && page >= 1 ? page : null }, { history: 'push' });
      },
      setPageSize: (size) => {
        replaceAndResetPage({ pageSize: size });
      },
      setFilter: (key, value) => {
        replaceAndResetPage({ [key]: value });
      },
      setSearch: (value, searchOptions) => {
        const limit: Options =
          searchOptions?.immediate === true ? {} : { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) };
        replaceAndResetPage({ search: normalizeSearch(value) }, limit);
      },
      setSort: (value) => {
        replaceAndResetPage({ sort: value });
      },
      setTab: (value) => {
        replaceAndResetPage({ tab: value });
      },
      setView: (value) => {
        replaceAndResetPage({ view: value });
      },
      clampPage: (lastPage) => {
        const page = (values as Record<string, unknown>).page;
        if (typeof page === 'number' && lastPage >= 1 && page > lastPage) {
          write({ page: lastPage }, { history: 'replace' });
        }
      },
      reset: () => {
        void setParams(null, { history: 'replace' });
      },
    };
    return [values, setters] as const;
  };
}
