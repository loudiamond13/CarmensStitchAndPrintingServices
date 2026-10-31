// The one way a list keeps its view in the URL (WEB-10): createListParams(parsers) returns a typed useXxxListParams()
// hook built on nuqs useQueryStates. A list reads and writes its state only through that hook and never copies it into
// useState or form state. The parsed, defaulted values it returns are the only input of the list's query (WEB-08).
// The state keys are the URL keys: page, size and q are shared by every list; the rest are the list's own.
import { parseAsString, useQueryStates, type Nullable, type Options, type ParserMap, type Values } from 'nuqs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clampPage as clampToPages, normalizeSearch } from './parsers';

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

/** Keys a filter setter may change: everything but the page (setPage) and the search (setSearch). */
type FilterKey<P extends ListParserMap> = Exclude<keyof P & string, 'page' | 'q'>;
type Arg<P extends ListParserMap, K extends string> = K extends keyof P ? Values<P>[K] | null : never;
type Patch<P extends ListParserMap> = Partial<Nullable<Values<P>>>;

/**
 * The list's setters. Every one but setPage replaces the history entry and resets the page in the same update. A write
 * made while a search waits carries that search in the same update; reset drops it.
 */
export interface ListParamsSetters<P extends ListParserMap> {
  /** Adds a history entry (push). Anything but an integer of at least 1 means page 1. */
  setPage: (page: number) => void;
  setPageSize: (size: Arg<P, 'size'>) => void;
  /**
   * Trims and caps the text. The list shows it at once; the URL gets the search and the page reset in one replace after
   * 300 ms of quiet, or at once with `immediate` (Enter).
   */
  setSearch: (text: string, options?: { immediate?: boolean }) => void;
  /** One filter, sort, tab or view value; null or the default removes it from the URL. */
  setFilter: <K extends FilterKey<P>>(key: K, value: Values<P>[K] | null) => void;
  /** Several filter values in one update (for example a date range's range, from and to). */
  setFilters: (patch: Partial<Nullable<Pick<Values<P>, FilterKey<P>>>>) => void;
  /** Once the page count is known: a page past the last page becomes the last page (0 pages: page 1), with replace. */
  clampPage: (totalPages: number) => void;
  /** Clears every key of this list in one replace. */
  reset: () => void;
}

/** Quiet time before a search is written to the URL (WEB-08, WEB-10). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * URL parameter names that would carry personal data or a secret (WEB-10 privacy rules, CWE-598). Personal data may
 * appear only inside the free-text `q`; tokens, codes and secrets never appear in a URL. Names are compared lower-case
 * with everything but letters removed, so `Email`, `customer_name` and `access-token` are caught too. A name that
 * contains one of the fragments is refused; the short words are refused only as the whole name, so `orderCode` and
 * `notPaid` stay allowed.
 */
const FORBIDDEN_FRAGMENTS: readonly string[] = ['email', 'phone', 'mobile', 'password', 'passwd', 'secret', 'token'];
const FORBIDDEN_NAMES: ReadonlySet<string> = new Set([
  'otp',
  'code',
  'pin',
  'name',
  'firstname',
  'lastname',
  'fullname',
  'customername',
  'address',
]);

function assertAllowedUrlKey(key: string): void {
  const letters = key.toLowerCase().replace(/[^a-z]/g, '');
  if (FORBIDDEN_NAMES.has(letters) || FORBIDDEN_FRAGMENTS.some((fragment) => letters.includes(fragment))) {
    throw new TypeError(
      `"${key}" must not be a URL parameter: personal data goes only in the free-text search (q), and tokens, codes and secrets never go in a URL (WEB-10).`,
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
 * The URL rewrite that makes every present key canonical, or null when the URL already is. A key whose raw value is
 * invalid, or equals its default, is removed; a valid value that serializes differently (an untrimmed search) is
 * rewritten. Non-string raw values are skipped: the nuqs testing adapter echoes this hook's own typed writes into raw
 * reads, and those are canonical already (L-17).
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

/**
 * Defines one list's URL state. Throws at definition time when a key would put personal data or a secret in the URL.
 * Call it once at module level and export the hook it returns (for example `useOrdersListParams`).
 */
export function createListParams<P extends ListParserMap>(parsers: P) {
  const keys = Object.keys(parsers);
  for (const key of keys) {
    assertAllowedUrlKey(key);
  }
  const rawParsers: Record<string, typeof parseAsString> = Object.fromEntries(keys.map((key) => [key, parseAsString]));
  const pageReset: Record<string, null> = 'page' in parsers ? { page: null } : {};
  // What the list shows for the page once a reset is applied (the page default).
  const pageShownAfterReset: Record<string, unknown> =
    'page' in parsers ? { page: (parsers as Record<string, ListParser>).page?.defaultValue ?? null } : {};

  return function useListParams() {
    const [values, setParams] = useQueryStates(parsers);
    // The same keys as raw strings, to tell "absent" from "present but invalid" (both parse to the default).
    const [raw] = useQueryStates(rawParsers);

    // The search wait is timed here, not by nuqs: nuqs debounces each URL key on its own timer, so q and the page reset
    // could land as two URL updates (D-68). While it waits, the list already shows the typed search and page 1.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const waitingPatch = useRef<Record<string, unknown> | null>(null);
    const [waiting, setWaiting] = useState<Record<string, unknown> | null>(null);
    const shown = useMemo(() => (waiting === null ? values : { ...values, ...waiting }), [values, waiting]);

    useEffect(
      () => () => {
        if (timer.current !== null) clearTimeout(timer.current);
      },
      [],
    );

    // Normalize once: an invalid, default or non-canonical value is rewritten in a single replace. After it the URL is
    // canonical, so the next run finds nothing to change (idempotent).
    useEffect(() => {
      const patch = normalizationPatch(parsers, raw);
      if (patch !== null) {
        void setParams(patch as Patch<P>, { history: 'replace' });
      }
    }, [raw, setParams]);

    const stopWait = (): void => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      waitingPatch.current = null;
      setWaiting(null);
    };
    // One URL update. A search still waiting joins it (under the setter's own patch and options) and the wait ends.
    const write = (patch: Record<string, unknown>, options: Options): void => {
      const carried = waitingPatch.current;
      stopWait();
      void setParams({ ...carried, ...patch } as Patch<P>, options);
    };
    // Every change but a page change replaces the history entry and resets the page in the same single URL update.
    const replaceAndResetPage = (patch: Record<string, unknown>, extra: Options = {}): void => {
      write({ ...patch, ...pageReset }, { history: 'replace', ...extra });
    };

    const setters: ListParamsSetters<P> = {
      setPage: (page) => {
        write({ page: Number.isSafeInteger(page) && page >= 1 ? page : null }, { history: 'push' });
      },
      setPageSize: (size) => {
        replaceAndResetPage({ size });
      },
      setSearch: (text, options) => {
        const q = normalizeSearch(text);
        if (options?.immediate === true) {
          replaceAndResetPage({ q });
          return;
        }
        stopWait();
        waitingPatch.current = { q, ...pageReset };
        setWaiting({ q, ...pageShownAfterReset });
        timer.current = setTimeout(() => {
          write({}, { history: 'replace' });
        }, SEARCH_DEBOUNCE_MS);
      },
      setFilter: (key, value) => {
        replaceAndResetPage({ [key]: value });
      },
      setFilters: (patch) => {
        replaceAndResetPage(patch);
      },
      clampPage: (totalPages) => {
        const page = (shown as Record<string, unknown>).page;
        if (typeof page !== 'number') return;
        const target = clampToPages(page, totalPages);
        if (target !== page) {
          write({ page: target }, { history: 'replace' });
        }
      },
      reset: () => {
        stopWait();
        void setParams(null, { history: 'replace' });
      },
    };
    return [shown, setters] as const;
  };
}
